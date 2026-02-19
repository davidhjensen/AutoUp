# AutoUp: Hard-Hat Custimization Proof Generator
This app streamlines the workflow of sales reps for STUDSON by allowing proofs for helmet custimizations to be generated automatically rather than by a dedicated designer. The front end is a `.html` form hosted on Microsoft Azure Blob Storage and is where the helmet details are entered and custom logos to be printed on the helmets are uploaded. This form posts a request to a JavaScript Microsoft Azure Function App, which generates and returns the proof as a `.pdf`.

The forms are found in `./forms/`.

To debug the function, use Azure's extensions for VS Code to run `./azure/src/functions/httpAutoUpTrigger.js` locally. Then, update the form to post to the local address of the function.

<table>
  <tr>
    <td style="vertical-align: top;">
      <img src="https://github.com/user-attachments/assets/3a4361a4-e040-47ea-9a64-0ef903485a9e" width="100%">
    </td>
    <td style="vertical-align: top;">
      <img src="https://github.com/user-attachments/assets/4b4c0296-4fa3-4c7e-8943-83d7fb056e12" width="100%">
    </td>
  </tr>
</table>
