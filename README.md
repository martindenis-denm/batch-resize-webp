# Batch resize images and save them as WebP

## How to use
To use the script:
* Prepare a folder with all your source images to resize, and a destination folder for the script to put the resulting images.
* Just drag the main.js file in your photoshop window (> 2022), or go under File > Scripts > Browse and then find main.js.
* A modal box will appear, choose your settings and click resize!

<img width="468" alt="Screenshot 2025-02-07 at 14 30 03" src="https://github.com/user-attachments/assets/575fda0b-e9ef-4c11-9e33-f1d1e12fd82c" />

## Notes
### Width x Height
As of now, you can theoratically resize to bigger width and/or height, even though I've never tested it.
Also I don't see the point in doing that, since you'll be losing quality in the process.

### Overlay color
This can be useful if you want all your image to be a certain color (ie: transform all your logos in white)
The Overlay color won't be applied on images without a transparent background to avoid the whole output image being just one color.

### Input folder
The script will only try to find source files (webp|tif|tiff|jpg|jpeg|psd|psb|png) directly inside the specified input folder. I will not try to find them in its subfolder.

### Padding
You can apply an inner padding to the resize in "Contain" mode, the subject will be contained inside these new bounds.

### Contain resize method
When choosing the resize method "Contain", some magic will be used for all resulting image to appear the same size. It uses the **ratio of subject to background pixels** and the **difference between source image ratio to target image ratio** to best determine the real target size of the output image.
This means that your visuals will not always be contained to the canvas' borders, but also that really busy images will be rendered smaller than very light ones. (ex: bold logos will appear smaller than very thin ones).
This feature will only work with images having a **transparent or white brackground**.
