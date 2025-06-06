// js/las.js
// (Using the refined version from our previous discussion for robust color handling)

var LASParser = function(arraybuffer) {
    this.arraybuffer = arraybuffer;
    this.decoder = new TextDecoder(); // For decoding strings
};

LASParser.prototype.open = function() {
    return new Promise((resolve, reject) => {
        if (!this.arraybuffer) {
            return reject(new Error("ArrayBuffer not provided."));
        }
        this.readHeader()
            .then(resolve)
            .catch(reject);
    });
};

LASParser.prototype.readHeader = function() {
    return new Promise((resolve, reject) => {
        this.header = {};
        const dv = new DataView(this.arraybuffer);
        let offset = 0;

        // File Signature "LASF"
        this.header.fileSignature = this.decoder.decode(new Uint8Array(this.arraybuffer, offset, 4));
        offset += 4;
        if (this.header.fileSignature !== "LASF") {
            return reject(new Error("Not a LAS file (invalid signature)."));
        }

        this.header.fileSourceId = dv.getUint16(offset, true); offset += 2;
        this.header.globalEncoding = dv.getUint16(offset, true); offset += 2;
        // Skip GUID data 1-4
        offset += 16;
        this.header.versionMajor = dv.getUint8(offset); offset += 1;
        this.header.versionMinor = dv.getUint8(offset); offset += 1;

        this.header.systemIdentifier = this.decoder.decode(new Uint8Array(this.arraybuffer, offset, 32)).trim(); offset += 32;
        this.header.generatingSoftware = this.decoder.decode(new Uint8Array(this.arraybuffer, offset, 32)).trim(); offset += 32;

        this.header.fileCreationDayOfYear = dv.getUint16(offset, true); offset += 2;
        this.header.fileCreationYear = dv.getUint16(offset, true); offset += 2;
        this.header.headerSize = dv.getUint16(offset, true); offset += 2;
        this.header.offsetToPointData = dv.getUint32(offset, true); offset += 4;
        this.header.numberOfVariableLengthRecords = dv.getUint32(offset, true); offset += 4;
        this.header.pointDataRecordFormat = dv.getUint8(offset); offset += 1;
        this.header.pointDataRecordLength = dv.getUint16(offset, true); offset += 2;
        this.header.legacyNumberOfPointRecords = dv.getUint32(offset, true); offset += 4;
        for (let i = 0; i < 5; i++) {
            offset += 4; // Skip legacy_number_of_points_by_return
        }

        this.header.xScaleFactor = dv.getFloat64(offset, true); offset += 8;
        this.header.yScaleFactor = dv.getFloat64(offset, true); offset += 8;
        this.header.zScaleFactor = dv.getFloat64(offset, true); offset += 8;
        this.header.xOffset = dv.getFloat64(offset, true); offset += 8;
        this.header.yOffset = dv.getFloat64(offset, true); offset += 8;
        this.header.zOffset = dv.getFloat64(offset, true); offset += 8;

        this.header.maxX = dv.getFloat64(offset, true); offset += 8;
        this.header.minX = dv.getFloat64(offset, true); offset += 8;
        this.header.maxY = dv.getFloat64(offset, true); offset += 8;
        this.header.minY = dv.getFloat64(offset, true); offset += 8;
        this.header.maxZ = dv.getFloat64(offset, true); offset += 8;
        this.header.minZ = dv.getFloat64(offset, true); offset += 8;

        if (this.header.versionMajor === 1 && this.header.versionMinor >= 3 && this.header.headerSize >= 235) {
            offset = 235;
            this.header.startOfWaveformDataPacketRecord = dv.getBigUint64(offset, true); offset += 8;
        }
        
        if (this.header.versionMajor === 1 && this.header.versionMinor >= 4 && this.header.headerSize >= 243) {
            offset = 243;
            this.header.startOfFirstExtendedVariableLengthRecord = dv.getBigUint64(offset, true); offset += 8;
            this.header.numberOfExtendedVariableLengthRecords = dv.getUint32(offset, true); offset += 4;
            this.header.numberOfPointRecords = dv.getBigUint64(offset, true); offset += 8;
            for (let i = 0; i < 15; i++) {
               offset += 8; // Skip number_of_points_by_return
            }
        } else {
            this.header.numberOfPointRecords = BigInt(this.header.legacyNumberOfPointRecords);
        }

        console.log("LAS Header:", this.header);
        resolve(this.header);
    });
};

LASParser.prototype.getPoints = function(numPointsToRead = Infinity) {
     return new Promise((resolve, reject) => {
        if (!this.header) {
            return reject(new Error("Header not read. Call open() first."));
        }

        const numPoints = Math.min(Number(this.header.numberOfPointRecords), numPointsToRead);
        const points = {
            count: numPoints,
            position: new Float32Array(numPoints * 3),
            color: new Float32Array(numPoints * 3),
            intensity: new Uint16Array(numPoints),
            classification: new Uint8Array(numPoints)
        };

        const dv = new DataView(this.arraybuffer);
        let currentOffset = this.header.offsetToPointData;
        const pdrf = this.header.pointDataRecordFormat;
        const pdrLength = this.header.pointDataRecordLength;

        const pdrfSupportsColor = (pdrf === 2 || pdrf === 3 || pdrf === 5 || pdrf === 7 || pdrf === 8 || pdrf === 10);
        points.hasColor = pdrfSupportsColor;

        for (let i = 0; i < numPoints; i++) {
            const pointOffset = currentOffset;

            const x = dv.getInt32(pointOffset, true);
            const y = dv.getInt32(pointOffset + 4, true);
            const z = dv.getInt32(pointOffset + 8, true);

            points.position[i * 3 + 0] = x * this.header.xScaleFactor + this.header.xOffset;
            points.position[i * 3 + 1] = y * this.header.yScaleFactor + this.header.yOffset;
            points.position[i * 3 + 2] = z * this.header.zScaleFactor + this.header.zOffset;

            points.intensity[i] = dv.getUint16(pointOffset + 12, true);
            points.classification[i] = dv.getUint8(pointOffset + 15, true);

            if (pdrfSupportsColor) {
                let colorOffset = 20;
                if (pdrf === 3 || pdrf === 5 || pdrf === 7 || pdrf === 8 || pdrf === 10) {
                    colorOffset += 8; // Skip GPS time
                }

                if (pointOffset + colorOffset + 6 <= this.arraybuffer.byteLength && currentOffset + pdrLength >= pointOffset + colorOffset + 6) {
                    points.color[i * 3 + 0] = dv.getUint16(pointOffset + colorOffset + 0, true) / 65535.0;
                    points.color[i * 3 + 1] = dv.getUint16(pointOffset + colorOffset + 2, true) / 65535.0;
                    points.color[i * 3 + 2] = dv.getUint16(pointOffset + colorOffset + 4, true) / 65535.0;
                } else {
                    points.color[i * 3 + 0] = 0.5;
                    points.color[i * 3 + 1] = 0.5;
                    points.color[i * 3 + 2] = 0.5;
                }
            } else {
                const intensityNormalized = Math.min(points.intensity[i] / 65535.0, 1.0);
                points.color[i * 3 + 0] = intensityNormalized;
                points.color[i * 3 + 1] = intensityNormalized;
                points.color[i * 3 + 2] = intensityNormalized;
            }
            currentOffset += pdrLength;
            if (currentOffset > this.arraybuffer.byteLength) {
                console.warn("Attempting to read beyond ArrayBuffer bounds. Truncating point list.");
                points.count = i + 1; // Adjust count to actual number of points read
                // Resize typed arrays
                points.position = points.position.slice(0, (i + 1) * 3);
                points.color = points.color.slice(0, (i + 1) * 3);
                points.intensity = points.intensity.slice(0, i + 1);
                points.classification = points.classification.slice(0, i + 1);
                break; 
            }
        }
        console.log(`Read ${points.count} points.`);
        resolve(points);
    });
};