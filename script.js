const SERVICE_UUID = "bf88b656-0000-4a61-86e0-769c741026c0";
const FILE_BLOCK_UUID = "bf88b656-3000-4a61-86e0-769c741026c0";
const FILE_LENGTH_UUID = "bf88b656-3001-4a61-86e0-769c741026c0";
const FILE_MAXIMUM_LENGTH_UUID = "bf88b656-3002-4a61-86e0-769c741026c0";
const FILE_CHECKSUM_UUID = "bf88b656-3003-4a61-86e0-769c741026c0";
const COMMAND_UUID = "bf88b656-3004-4a61-86e0-769c741026c0";
const TRANSFER_STATUS_UUID = "bf88b656-3005-4a61-86e0-769c741026c0";
const ERROR_MESSAGE_UUID = "bf88b656-3006-4a61-86e0-769c741026c0";

const connectButton = document.getElementById("connect-button");
const transferFileButton = document.getElementById("transfer-file-button");
const transferCustomFileButton = document.getElementById("test-this-file");
const startTransferButton = document.getElementById(
    "start-transfer-button"
);
const cancelTransferButton = document.getElementById(
    "cancel-transfer-button"
);
const statusElement = document.getElementById("status-label");
let imageData;
const outDataCanvas = document.getElementById("out-img-test");

// Check that the browser supports WebBLE, and raise a warning if not.
if (!("bluetooth" in navigator)) {
    msg("Browser not supported");
    alert(
        "Error: This browser doesn't support Web Bluetooth. Try using Chrome."
    );
}

connectButton.addEventListener("click", function(event) {
    connect();

    transferCustomFileButton.addEventListener("change", function(e) {
        function handleImage(e) {
            var reader = new FileReader();
            const canvas = document.getElementById("out-img-test");
            var ctx = canvas.getContext("2d");
            reader.onload = async function(event) {
                var img = new Image();
                img.src = event.target.result;
                img.onload = function() {
                    canvas.width = 400;
                    canvas.height = 300;
                    ctx.fillStyle = "black";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

//                     ctx.drawImage(img, 0, 0);
                    // get the scale
                    // it is the min of the 2 ratios
                    let scale_factor = Math.min(canvas.width / img.width, canvas.height / img.height);

                    // Lets get the new width and height based on the scale factor
                    let newWidth = img.width * scale_factor;
                    let newHeight = img.height * scale_factor;

                    // get the top left position of the image
                    // in order to center the image within the canvas
                    let x = (canvas.width / 2) - (newWidth / 2);
                    let y = (canvas.height / 2) - (newHeight / 2);

                    // When drawing the image, we have to scale down the image
                    // width and height in order to fit within the canvas
                    ctx.drawImage(img, x, y, newWidth, newHeight);

                    var context = document
                        .getElementById("out-img-test")
                        .getContext("2d");

                    // Get the CanvasPixelArray from the given coordinates and dimensions.
                    var imgd = context.getImageData(0, 0, 400, 300);
                    var pix = imgd.data;

                    // Loop over each pixel and invert the color.
                    var outImageDataTemp1 = new Uint8Array(120000);
                    for (var i = 0, n = pix.length; i < n; i += 4) {
                        // const pixelActual = Math.floor(
                        //   (pix[i] + pix[i + 1] + pix[i + 2]) / 3
                        // );
                        const pixelActual = Math.min(
                            255,
                            Math.floor(pix[i] * 0.299) +
                            Math.floor(pix[i + 1] * 0.565) +
                            Math.floor(pix[i + 2] * 0.114)
                        );
                        outImageDataTemp1[i / 4] = pixelActual > 60 ? 1 : 0;
                        // outImageDataTemp1[i / 4] = pixelActual > 50 ? 0 : 1;
                    }
                    var outImageDataTemp2 = new Uint8Array(
                        15104
                        // outImageDataTemp1.byteLength / 8
                    );
                    const maxSize = outImageDataTemp1.byteLength;
                    for (var i = 0; i < maxSize; i += 8) {
                        var tempInt = 0;
                        for (let bs = 0; bs < 8; bs++) {
                            tempInt = tempInt | outImageDataTemp1[i + bs];
                            // tempInt = tempInt | outImageDataTemp1[i - bs + 7];
                            tempInt = bs < 7 ? tempInt << 1 : tempInt;
                        }
                        outImageDataTemp2[i / 8] = tempInt;
                    }
                    const outImageDataTemp3 = outImageDataTemp2.buffer;
                    imageData = outImageDataTemp3;
                    console.log(imageData);
                    // transferFile(outImageDataTemp3);
                };
            };
            reader.readAsDataURL(e.target.files[0]);
        }
        handleImage(e);
    });

    startTransferButton.addEventListener("click", function(event) {
        msg("Starting Transfer");
        transferFile(imageData);

        // cancelTransfer();
    });

    cancelTransferButton.addEventListener("click", function(event) {
        msg("Trying to cancel transfer ...");
        cancelTransfer();
    });
});

// ------------------------------------------------------------------------------
// This section contains functions you may want to customize for your own page.

// You'll want to replace these two functions with your own logic, to take what
// actions your application needs when a file transfer succeeds, or errors out.
async function onTransferSuccess() {
    // isFileTransferInProgress = false;
    // let checksumValue = await fileChecksumCharacteristic.readValue();
    // let checksumArray = new Uint32Array(checksumValue.buffer);
    // let checksum = checksumArray[0];
    // msg("File transfer succeeded: Checksum 0x" + checksum.toString(16));
    msg("Transfer Success");
}

// Called when something has gone wrong with a file transfer.
function onTransferError() {
    isFileTransferInProgress = false;
    msg("File transfer error");
}

// Called when an error message is received from the device. This describes what
// went wrong with the transfer in a user-readable form.
function onErrorMessageChanged(event) {
    let value = new Uint8Array(event.target.value.buffer);
    let utf8Decoder = new TextDecoder();
    let errorMessage = utf8Decoder.decode(value);
    console.log("Error message = " + errorMessage);
}

// Display logging information in the interface, you'll want to customize this
// for your page.
function msg(m) {
    statusElement.innerHTML = m;
}

// ------------------------------------------------------------------------------
// This section has the public APIs for the transfer process, which you
// shouldn't need to modify but will have to call.

async function connect() {
    msg("Requesting device ...");

    const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [SERVICE_UUID] }],
    });

    msg("Connecting to device ...");

    function onDisconnected(event) {
        msg("Device " + device.name + " is disconnected.");
    }
    device.addEventListener("gattserverdisconnected", onDisconnected);
    const server = await device.gatt.connect();

    msg("Getting primary service ...");
    const service = await server.getPrimaryService(SERVICE_UUID);

    msg("Getting characteristics ...");
    fileBlockCharacteristic = await service.getCharacteristic(
        FILE_BLOCK_UUID
    );
    fileLengthCharacteristic = await service.getCharacteristic(
        FILE_LENGTH_UUID
    );
    fileMaximumLengthCharacteristic = await service.getCharacteristic(
        FILE_MAXIMUM_LENGTH_UUID
    );
    fileChecksumCharacteristic = await service.getCharacteristic(
        FILE_CHECKSUM_UUID
    );
    commandCharacteristic = await service.getCharacteristic(COMMAND_UUID);
    transferStatusCharacteristic = await service.getCharacteristic(
        TRANSFER_STATUS_UUID
    );
    await transferStatusCharacteristic.startNotifications();
    transferStatusCharacteristic.addEventListener(
        "characteristicvaluechanged",
        onTransferStatusChanged
    );
    errorMessageCharacteristic = await service.getCharacteristic(
        ERROR_MESSAGE_UUID
    );
    await errorMessageCharacteristic.startNotifications();
    errorMessageCharacteristic.addEventListener(
        "characteristicvaluechanged",
        onErrorMessageChanged
    );

    isFileTransferInProgress = false;

    msg("Connected to device");
}

async function transferFile(fileContents) {
    let maximumLengthValue =
        await fileMaximumLengthCharacteristic.readValue();
    let maximumLengthArray = new Uint32Array(maximumLengthValue.buffer);
    let maximumLength = maximumLengthArray[0];
    if (fileContents.byteLength > maximumLength) {
        msg(
            "File length is too long: " +
            fileContents.byteLength +
            " bytes but maximum is " +
            maximumLength
        );
        return;
    }

    if (isFileTransferInProgress) {
        msg("Another file transfer is already in progress");
        return;
    }

    let fileLengthArray = Int32Array.of(fileContents.byteLength);
    await fileLengthCharacteristic.writeValue(fileLengthArray);
    let fileChecksum = crc32(fileContents);
    let fileChecksumArray = Uint32Array.of(fileChecksum);
    await fileChecksumCharacteristic.writeValue(fileChecksumArray);

    let commandArray = Int32Array.of(1);
    await commandCharacteristic.writeValue(commandArray);

    sendFileBlock(fileContents, 0);
}

async function cancelTransfer() {
    let commandArray = Int32Array.of(2);
    await commandCharacteristic.writeValue(commandArray);
}

// ------------------------------------------------------------------------------
// The rest of these functions are internal implementation details, and shouldn't
// be called by users of this module.

function onTransferInProgress() {
    isFileTransferInProgress = true;
}

function onTransferStatusChanged(event) {
    let value = new Uint32Array(event.target.value.buffer);
    let statusCode = value[0];
    if (statusCode === 0) {
        onTransferSuccess();
    } else if (statusCode === 1) {
        onTransferError();
    } else if (statusCode === 2) {
        onTransferInProgress();
    }
}

function prepareDummyFileContents(fileLength) {
    let result = new ArrayBuffer(fileLength);
    let bytes = new Uint8Array(result);
    const contentString = "00000000001111111111";
    //   const contentString = "The quick brown fox jumped over the lazy dog. ";
    for (var i = 0; i < bytes.length; ++i) {
        var contentIndex = i % contentString.length;
        bytes[i] = contentString.charCodeAt(contentIndex);
    }
    return result;
}

// See http://home.thep.lu.se/~bjorn/crc/ for more information on simple CRC32 calculations.
function crc32ForByte(r) {
    for (let j = 0; j < 8; ++j) {
        r = (r & 1 ? 0 : 0xedb88320) ^ (r >>> 1);
    }
    return r ^ 0xff000000;
}

function crc32(dataIterable) {
    const tableSize = 256;
    if (!window.crc32Table) {
        crc32Table = new Uint32Array(tableSize);
        for (let i = 0; i < tableSize; ++i) {
            crc32Table[i] = crc32ForByte(i);
        }
        window.crc32Table = crc32Table;
    }
    let dataBytes = new Uint8Array(dataIterable);
    let crc = 0;
    for (let i = 0; i < dataBytes.byteLength; ++i) {
        const crcLowByte = crc & 0x000000ff;
        const dataByte = dataBytes[i];
        const tableIndex = crcLowByte ^ dataByte;
        // The last >>> is to convert this into an unsigned 32-bit integer.
        crc = (window.crc32Table[tableIndex] ^ (crc >>> 8)) >>> 0;
    }
    return crc;
}

// This is a small test function for the CRC32 implementation, not normally called but left in
// for debugging purposes. We know the expected CRC32 of [97, 98, 99, 100, 101] is 2240272485,
// or 0x8587d865, so if anything else is output we know there's an error in the implementation.
function testCrc32() {
    const testArray = [97, 98, 99, 100, 101];
    const testArrayCrc32 = crc32(testArray);
    console.log(
        "CRC32 for [97, 98, 99, 100, 101] is 0x" +
        testArrayCrc32.toString(16) +
        " (" +
        testArrayCrc32 +
        ")"
    );
}


async function sendFileBlock(fileContents, bytesAlreadySent) {
    let bytesRemaining = fileContents.byteLength - bytesAlreadySent;

    const maxBlockLength = 128;
    //   const maxBlockLength = 128;
    const blockLength = Math.min(bytesRemaining, maxBlockLength);
    var blockView = new Uint8Array(
        fileContents,
        bytesAlreadySent,
        blockLength
    );
    //   console.log(blockView);
    fileBlockCharacteristic
        .writeValue(blockView)
        .then((_) => {
            // console.log(bytesRemaining);
            bytesRemaining -= blockLength;
            if (bytesRemaining > 0 && isFileTransferInProgress) {
                msg("File block written - " + bytesRemaining + " bytes remaining");
                document.getElementById("progress-out").innerHTML = `${(bytesAlreadySent / 15000 * 100).toFixed(2)} %`;
                document.getElementById("progress-out").style.width = `${bytesAlreadySent / 15104 * 100}%`;
                bytesAlreadySent += blockLength;
                sendFileBlock(fileContents, bytesAlreadySent);
            }
        })
        .catch((error) => {
            console.log(error);
            msg(
                "File block write error with " +
                bytesRemaining +
                " bytes remaining, see console"
            );
        });
}

document.getElementById("test-btn").addEventListener("click", () => {
    const bytesAlreadySent = 70;
    document.getElementById("progress-out").innerHTML = `${(bytesAlreadySent / 150).toFixed(2)} %`;
    document.getElementById("progress-out").style.width = `${bytesAlreadySent / 150}%`;
})
