# Batch resize images and save them as WebP

Drag & Drop this script in your photoshop (>= 2022)
A modal will appear, choose your settings and click resize!

This script works best with images having a **transparent or white brackground**.

The Overlay color won't be applied on images without a transparent background to avoid the whole output image being just one color

When choosing the resize method "Contain", some magic will be used for all resulting image to appear the same size.
It uses the **ratio of useful to background pixels** and the **ratio of source image ratio to target image ratio** to best determine the real target size of the output image.
This means that your visuals will not always be contained to the canvas' borders, but also that really busy images will be rendered smaller than very light ones. (ex: bold logos will appear smaller than very thin ones)
