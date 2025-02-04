#target photoshop

var DEFAULT_WIDTH = 480;
var DEFAULT_HEIGHT = 240;
var DEFAULT_QUALITY = 93;
var DEFAULT_INPUT_FOLDER = "";
var DEFAULT_OUTPUT_FOLDER = "";
var COMPRESSION = "compressionLossy"; // "compressionLossless" | "compressionLossy"
var versionNumber = app.version.split(".");
var versionCheck = parseInt(versionNumber);
var userInput = null;

// Ensure that version 2022 or later is being used
if (versionCheck < 23) {
    // Fail
    alert("You must use Photoshop 2022 or later to save using native WebP format...");
} else {
    // Pass
    init();
}

function init() {
    // Get the input and output folders
    userInput = showDialog();

    if (userInput == null) {
        return;
    }

    // Limit the input files, add or remove extensions as required
    var files = userInput.inputFolder.getFiles(/\.(webp|tif|tiff|jpg|jpeg|psd|psb|png)$/i);
    var savedDisplayDialogs = app.displayDialogs;
    app.displayDialogs = DialogModes.NO;
    files.sort();

    // Set the file processing counter
    var fileCounter = 0;

    // This background color will be retained accross all files
    setBackgroundColor({ r: 255, g: 255, b: 255 });

    // Process the input files
    for (var i = 0; i < files.length; i++) {
        // Open the file in photoshop
        open(files[i]);

        // Process the file
        processFile();

        // Increment the file saving counter
        fileCounter++;
    };

    app.displayDialogs = savedDisplayDialogs;
    alert('Script completed!' + '\n' + fileCounter + ' files saved to:' + '\r' + userInput.outputFolder.fsName);
}

// Main function to handle each file
function processFile() {
    // First remove transparent pixels and crop image to useful content pixels only
    cropToContent();

    // Resize document to dimensions specified by user
    resizeDocument();

    // Change document color
    applyColor();

    // Save as a copy and close
    saveWebP(COMPRESSION, userInput, false, true, false, true);
    app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
}

// Select the content of the active layer and crop the canvas to the content's bounds
function cropToContent() {
    // Select content of the active layer
    selectLayerContent();

    // Get the bounds of the selection
    var layerBounds = app.activeDocument.selection.bounds;
    var left = layerBounds[0].as('px');  // Left of the active layer
    var top = layerBounds[1].as('px');   // Top of the active layer
    var right = layerBounds[2].as('px'); // Right of the active layer
    var bottom = layerBounds[3].as('px'); // Bottom of the active layer

    // Crop (bounding box of the selection)
    app.activeDocument.crop([left, top, right, bottom]);
}

// Resize document to dimensions specified by user
function resizeDocument() {
    var doc = app.activeDocument;
    var sourceWidth = doc.width;
    var sourceHeight = doc.height;
    var sourceRatio = sourceWidth / sourceHeight;
    var targetRatio = userInput.width / userInput.height;
    var backgroundRatio = getBgToSubjectRatio();
    var resizeFactor = 1;

    // This is some kind of smart resize.
    // We take the density of "subject pixels" and the difference in image ratios to output a visually appealing resize.
    // The goal is the make all output images look similar in size.
    if (userInput.resizeMode == "contain" && backgroundRatio > 0 && backgroundRatio < 1) {
        // The more the source ratio is different from the target ratio, the less we scale down the image
        if (sourceRatio > targetRatio) {
            var sizeRatioDelta = sourceRatio / targetRatio;
        } else {
            var sizeRatioDelta = targetRatio / sourceRatio;
        }

        sizeRatioDelta = sizeRatioDelta / 3 + 0.33; // These values were found by trial and error
        backgroundRatio = backgroundRatio + 0.125 + (1 - backgroundRatio) * 0.5; // These values were found by trial and error

        resizeFactor = Math.min(1, sizeRatioDelta * backgroundRatio);
    }

    var targetWidth = userInput.width * resizeFactor - userInput.padding * 2; // Compute final width
    var targetHeight = userInput.height * resizeFactor - userInput.padding * 2; // Compute final height
    targetRatio = targetWidth / targetHeight; // Re-compute target ratio to take padding a resize factor into account

    // Resize the image
    if ((userInput.resizeMode == "contain" && sourceRatio > targetRatio)
        || (userInput.resizeMode == "cover" && sourceRatio <= targetRatio)) {
        doc.resizeImage(targetWidth, targetWidth / sourceRatio);
    } else {
        doc.resizeImage(targetHeight * sourceRatio, targetHeight);
    }

    // Crop or pad the canvas to match the target size
    doc.resizeCanvas(userInput.width, userInput.height, AnchorPosition.MIDDLECENTER);
}

// Set the background color of the document
// so that photoshop uses it when upsizing the canvas
function setBackgroundColor(newColor) {
    var color = app.backgroundColor;
    color.rgb.red = newColor.r;
    color.rgb.green = newColor.g;
    color.rgb.blue = newColor.g;

    app.backgroundColor = color;
}

// Get the ratio of background (transparent or white) to subjects pixels
// Returns a value between 0 and 1
function getBgToSubjectRatio() {
    var doc = app.activeDocument;

    // Ensure there's an active layer
    if (!doc.activeLayer) {
        throw new Error("No active layer found.");
    }

    // Select the content of the active layer
    selectLayerContent();

    // Add a new channel to store selection data
    var tempChannel = doc.channels.add();
    doc.selection.store(tempChannel, SelectionType.REPLACE);

    // Invert the selection (so opaque or non white pixels are selected)
    doc.selection.invert();

    // Get the histogram for the new channel
    var histogram = tempChannel.histogram;

    // First index of the histogram represents fully transparent or white pixels
    var backgroundPixelCount = histogram[0];

    // Total number of pixels in the image
    var totalPixels = doc.width * doc.height;

    // Delete the temporary Channel
    tempChannel.remove();

    // Compute the ratio of non-background pixels
    var backgroundRatio = backgroundPixelCount / totalPixels;

    return backgroundRatio; // Ensure result is between 0 and 1
}

// Check if the file has transparency by trying to access the transparency channel
function hasFileTransparency() {
    try {
        var ref = new ActionReference();
        ref.putEnumerated(s2t('channel'), s2t('channel'), s2t('transparencyEnum'));
        executeActionGet(ref); // If this succeeds, transparency exists
        return true;
    } catch (e) {
        return false; // JPEGs will fail here since they have no transparency channel
    }
}

// Select the content of the active layer
// If the layer has transparency, select the transparent pixels
// Otherwise, select non white pixels
function selectLayerContent() {
    var hasTransparency = hasFileTransparency();

    if (hasTransparency) {
        (ref1 = new ActionReference()).putProperty(c = s2t('channel'), s2t('selection'));
        (dsc = new ActionDescriptor()).putReference(s2t('null'), ref1);
        (ref2 = new ActionReference()).putEnumerated(c, c, s2t('transparencyEnum'))
        dsc.putReference(s2t('to'), ref2), executeAction(s2t('set'), dsc, DialogModes.NO);
    } else {
        var dsc = new ActionDescriptor();
        dsc.putInteger(s2t("fuzziness"), 0); // Adjust if needed
        dsc.putBoolean(s2t("invert"), true); // Invert to select the actual content
        dsc.putEnumerated(s2t("selectionType"), s2t("selectionType"), s2t("sampledColors"));

        executeAction(s2t("colorRange"), dsc, DialogModes.NO);
    }
}

// Change the color mode of the document and apply color overlay
function applyColor() {
    // If the doc isn't in RGB mode
    if (app.activeDocument.mode !== DocumentMode.RGB) {
        // Convert to sRGB
        app.activeDocument.convertProfile("sRGB IEC61966-2.1", Intent.RELATIVECOLORIMETRIC, true, false);
        app.activeDocument.changeMode(ChangeMode.RGB);
    } // If the doc is in RGB mode

    // Convert to 8 bpc
    app.activeDocument.bitsPerChannel = BitsPerChannelType.EIGHT;

    // Apply the overlay color if it's not null and the file has transparency
    // Otherwise the overlay would be applied to the whole image
    if (userInput.overlayColor != null && hasFileTransparency()) {
        applyColorOverlay(userInput.overlayColor);
    }
}

/**
 * Apply an overlay color effect on the current layer
 * This function won't be fired when file has no transparency
 * https://graphicdesign.stackexchange.com/questions/120623/how-to-change-in-photoshop-script-color-of-smart-object-layer-or-rasterized-ima
 */
function applyColorOverlay(color) {
    var desc6 = new ActionDescriptor();
    var ref1 = new ActionReference();
    ref1.putProperty(charIDToTypeID('Prpr'), charIDToTypeID('Lefx'));
    ref1.putEnumerated(charIDToTypeID('Lyr '), charIDToTypeID('Ordn'), charIDToTypeID('Trgt'));
    desc6.putReference(charIDToTypeID('null'), ref1);
    var desc7 = new ActionDescriptor();
    var desc8 = new ActionDescriptor();
    desc8.putBoolean(charIDToTypeID('enab'), true);
    desc8.putBoolean(s2t('present'), true);
    desc8.putBoolean(s2t('showInDialog'), true);
    desc8.putEnumerated(charIDToTypeID('Md  '), charIDToTypeID('BlnM'), charIDToTypeID('Nrml'));
    var desc9 = new ActionDescriptor();
    desc9.putDouble(charIDToTypeID('Rd  '), color.r);
    desc9.putDouble(charIDToTypeID('Grn '), color.g);
    desc9.putDouble(charIDToTypeID('Bl  '), color.b);
    desc8.putObject(charIDToTypeID('Clr '), charIDToTypeID('RGBC'), desc9);
    desc8.putUnitDouble(charIDToTypeID('Opct'), charIDToTypeID('#Prc'), 100.000000);
    desc7.putObject(charIDToTypeID('SoFi'), charIDToTypeID('SoFi'), desc8);
    desc6.putObject(charIDToTypeID('T   '), charIDToTypeID('Lefx'), desc7);
    executeAction(charIDToTypeID('setd'), desc6, DialogModes.NO);
}

// Show the dialog to get user input
function showDialog() {
    var dialog = new Window("dialog", "Batch resize and save as WebP");

    dialog.alignChildren = "left";
    dialog.spacing = 8;

    // Width input
    var widthGroup = dialog.add("group");
    widthGroup.spacing = 4;
    var widthLabel = widthGroup.add("statictext", undefined, "Width x Height");
    widthLabel.preferredSize = [100, 15];
    var widthInput = widthGroup.add("editnumber", undefined, DEFAULT_WIDTH);
    widthInput.characters = 6;
    widthGroup.add("statictext", undefined, "x");
    var heightInput = widthGroup.add("editnumber", undefined, DEFAULT_HEIGHT);
    heightInput.characters = 6;
    widthGroup.add("statictext", undefined, "px");

    // Webp Lossy quality
    var qualityGroup = dialog.add("group");
    qualityGroup.spacing = 4;
    var qualityLabel = qualityGroup.add("statictext", undefined, "Quality");
    qualityLabel.preferredSize = [100, 15];
    var qualitySlider = qualityGroup.add("slider", undefined, DEFAULT_QUALITY, 0, 100); // Default 90, range 0-100
    qualitySlider.preferredSize.width = 240; // Set slider width
    var qualityValue = qualityGroup.add("editnumber", undefined, DEFAULT_QUALITY);
    qualityValue.characters = 4;
    qualitySlider.onChanging = function () {
        qualityValue.text = Math.round(qualitySlider.value).toString();
    };
    qualityValue.onChange = function () {
        var currentValue = parseInt(qualityValue.text);
        if (currentValue < 0) {
            qualityValue.text = "0";
            qualitySlider.value = 0;
        } else if (currentValue > 100) {
            qualityValue.text = "100";
            qualitySlider.value = 100;
        } else {
            qualitySlider.value = parseInt(qualityValue.text);
        }
    }

    // Cover / Contain
    var resizeModeGroup = dialog.add("group");
    resizeModeGroup.spacing = 4;
    var resizeModeLabel = resizeModeGroup.add("statictext", undefined, "Resize mode");
    resizeModeLabel.preferredSize = [100, 15];
    var radioGroup = resizeModeGroup.add("group");
    var containRadio = radioGroup.add("radiobutton", undefined, "Contain");  // Option 1: Contain
    containRadio.value = true;
    var coverRadio = radioGroup.add("radiobutton", undefined, "Cover");    // Option 2: Cover

    // Padding
    var paddingGroup = dialog.add("group");
    paddingGroup.spacing = 4;
    var paddingLabel = paddingGroup.add("statictext", undefined, "Padding");
    paddingLabel.preferredSize = [100, 15];
    var paddingInput = paddingGroup.add("editnumber", undefined, "0");
    paddingInput.characters = 6;
    paddingGroup.add("statictext", undefined, "px");

    containRadio.onClick = function () {
        paddingGroup.enabled = true; // Show input group when "Contain" is selected
    };

    coverRadio.onClick = function () {
        paddingGroup.enabled = false; // Hide input group when "Cover" is selected
    };

    var overlayColorGroup = dialog.add("group");
    overlayColorGroup.spacing = 4;
    // Add a display for the selected color
    var overlayColorLabel = overlayColorGroup.add("statictext", undefined, "Overlay color");
    overlayColorLabel.preferredSize = [100, 15];
    var colorDisplay = overlayColorGroup.add("button", undefined, "Pick a Color");
    colorDisplay.preferredSize = [140, 15];
    // Variable to store the chosen color
    var selectedColor = null;
    // Add an event listener to the button
    colorDisplay.onClick = function () {
        // Open the Photoshop color picker
        var color = app.showColorPicker();

        if (color) {
            selectedColor = {
                r: Math.round(app.foregroundColor.rgb.red),
                g: Math.round(app.foregroundColor.rgb.green),
                b: Math.round(app.foregroundColor.rgb.blue),
            };

            // Update the display with the selected color
            colorDisplay.text = "RGB(" + selectedColor.r + ", " + selectedColor.g + ", " + selectedColor.b + ")";
        } else {
            selectedColor = null;
            colorDisplay.text = "Pick a Color";
        }
    };

    // Input folder selection
    var inputFolderGroup = dialog.add("group");
    inputFolderGroup.spacing = 4;
    var inputFolderLabel = inputFolderGroup.add("statictext", undefined, "Input Folder");
    inputFolderLabel.preferredSize = [100, 15];
    var inputFolderText = inputFolderGroup.add("edittext", undefined, DEFAULT_INPUT_FOLDER);
    inputFolderText.characters = 24;
    var inputFolderButton = inputFolderGroup.add("button", undefined, "Browse");
    inputFolderButton.onClick = function () {
        var folder = Folder.selectDialog("Select the input folder");
        if (folder) inputFolderText.text = folder.fsName;
    };

    // Output folder selection
    var outputFolderGroup = dialog.add("group");
    outputFolderGroup.spacing = 4;
    var outputFolderLabel = outputFolderGroup.add("statictext", undefined, "Output Folder");
    outputFolderLabel.preferredSize = [100, 15];
    var outputFolderText = outputFolderGroup.add("edittext", undefined, DEFAULT_OUTPUT_FOLDER);
    outputFolderText.characters = 24;
    var outputFolderButton = outputFolderGroup.add("button", undefined, "Browse");
    outputFolderButton.onClick = function () {
        var folder = Folder.selectDialog("Select the output folder");
        if (folder) outputFolderText.text = folder.fsName;
    };

    // Buttons
    var buttonGroup = dialog.add("group");
    var cancelButton = buttonGroup.add("button", undefined, "Cancel");
    var okButton = buttonGroup.add("button", undefined, "Resize");
    buttonGroup.alignment = "right";

    // Handle cliks on the dialog buttons
    okButton.onClick = function () {
        dialog.close(1);
    };
    cancelButton.onClick = function () {
        dialog.close(0);
    };

    // Show the dialog and get the result
    if (dialog.show() === 1) {
        var width = parseInt(widthInput.text, 10);
        var height = parseInt(heightInput.text, 10);
        var quality = Math.round(qualitySlider.value);
        var resizeMode = containRadio.value ? "contain" : "cover";
        var padding = resizeMode == "contain" ? parseInt(paddingInput.text, 10) : 0;

        // Check if width and height are valid (greater than 0)
        if (width <= 0 || height <= 0) {
            alert("Width and height must be greater than 0.");
            return null; // Return null to prevent form submission
        }

        // Check if width and height are valid (greater than 0)
        if (quality < 0 || quality > 100) {
            alert("Quality must be between 0 and 100");
            return null; // Return null to prevent form submission
        }

        // Check if width and height are valid (greater than 0)
        if (resizeMode == "contain") {
            if (padding < 0 || padding > width / 2 || padding > height / 2) {
                alert("Padding must be between 0 and half of both width and height.");
                return null; // Return null to prevent form submission
            }
        }

        // Check if input folder exists and is not empty
        var inputFolder = new Folder(inputFolderText.text);
        if (!inputFolder.exists || inputFolder.getFiles().length === 0) {
            alert("Input folder is empty or does not exist.");
            return null; // Return null to prevent form submission
        }

        // Check if output folder exists
        var outputFolder = new Folder(outputFolderText.text);
        if (!outputFolder.exists) {
            alert("Output folder does not exist.");
            return null; // Return null to prevent form submission
        }

        return {
            width: width,
            height: height,
            quality: quality,
            resizeMode: resizeMode,
            inputFolder: inputFolder,
            outputFolder: outputFolder,
            padding: padding,
            overlayColor: selectedColor,
        };
    } else {
        return null; // User canceled
    }
}

/**
 * Actually save the file as WebP
 * 
 * v1.1 - 12th March 2023, Stephen Marsh
 * https://community.adobe.com/t5/photoshop-ecosystem-discussions/saving-webp-image-by-script/td-p/13642577
 */
function saveWebP(compressionType, userInput, xmpData, exifData, psData, asCopy) {
    // Doc and path save variables
    var WebPDocName = activeDocument.name.replace(/\.[^\.]+$/, ''); // Remove file extension
    var WebPSavePath = userInput.outputFolder + "/" + WebPDocName + ".webp" // Change path as needed
    var WebPFile = new File(WebPSavePath); // Create the file object
    var desc1 = new ActionDescriptor();
    var desc2 = new ActionDescriptor();

    // Compression parameters = "compressionLossless" | "compressionLossy"
    desc2.putEnumerated(s2t("compression"), s2t("WebPCompression"), s2t(compressionType)); // string variable
    if (compressionType === "compressionLossy") {
        // 0 (lowest lossy quality) - 100 (highest lossy quality)
        desc2.putInteger(s2t("quality"), userInput.quality); //  number variable
    }

    // Metadata options
    desc2.putBoolean(s2t("includeXMPData"), xmpData); // Boolean param moved to function call
    desc2.putBoolean(s2t("includeEXIFData"), exifData); // Boolean param moved to function call
    desc2.putBoolean(s2t("includePsExtras"), psData); // Boolean param moved to function call

    // WebP format and save path
    desc1.putObject(s2t("as"), s2t("WebPFormat"), desc2);
    desc1.putPath(s2t("in"), WebPFile); // Save path variable

    // Save As = false | Save As a Copy = true
    desc1.putBoolean(s2t("copy"), asCopy); // Boolean param moved to function call

    // The extension
    desc1.putBoolean(s2t("lowerCase"), true);

    // Execute the save
    executeAction(s2t("save"), desc1, DialogModes.NO); // Change NO to ALL for dialog
}

// Helper function to avoid typing the whole function over and over again
function s2t(s) {
    return app.stringIDToTypeID(s);
}
