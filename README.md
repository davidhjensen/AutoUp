# AutoUp: Hard-Hat Custimization Proof Generator
This app streamlines the workflow of sales reps for STUDSON by allowing proofs for helmet custimizations to be generated automatically rather than by a dedicated designer. The front end is a `.html` form hosted on Microsoft Azure Blob Storage and is where the helmet details are entered and custom logos to be printed on the helmets are uploaded. This form posts a request to a JavaScript Microsoft Azure Function App, which generates and returns the proof as a `.pdf`.

The forms are found in `./forms/`.

To debug the function, use Azure's extensions for VS Code to run `./azure/src/functions/httpAutoUpTrigger.js` locally. Then, update the form to post to the local address of the function.


This project provides functionality to automatically generate product mockups for sales reps. This is done (for now) through a local HTML form that is parsed and used to generate a mockup using JavaScript.
For now, run `test_form_read.js` by running `node test_form_read.js`. Then, fill out `form_v2.html` in `forms/`. The generated techpack is saved to `function/techpack.pdf`.