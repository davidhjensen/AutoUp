const Busboy = require('busboy');
const http = require('http');
const fs = require("fs");
const PDFdoc = require("pdfkit"); //pdflib
const { createCanvas, loadImage } = require('canvas');
const SVGtoPDF = require('svg-to-pdfkit');
const sharp = require('sharp');
const { timeStamp, time } = require("console");
const blobStream = require('blob-stream');

const server = http.createServer((req, res) => {
    if (req.method === 'POST') {
        const busboy = Busboy({ headers: req.headers });
        const fields = {};
        const files = {};
        let company_name;

        // read and store fields
        busboy.on('field', (fieldname, val) => {
            console.log(`Field [${fieldname}]: value: ${val}`);
            if (fields[fieldname] != null) {
                fields[fieldname].push(val);
            } else {
                fields[fieldname] = [val];
            }
            if (fieldname=="companyName") {
                company_name = val;
            }
        });

        // read and store files
        busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
            console.log(`File [${fieldname}] received: ${filename}`);
            // Collect chunks of file data
            const chunks = [];
            file.on('data', (data) => {
                console.log(`File [${fieldname}] chunk received (${data.length} bytes)`);
                chunks.push(data); // Add chunk to array
            });

            file.on('end', () => {
                console.log(`File [${fieldname}] finished`);
                const fileBuffer = Buffer.concat(chunks); // Combine chunks into a single buffer
                files[fieldname] = { fieldname, filename, mimetype, buffer: fileBuffer }; // Store buffer and metadata
            });
        });

        busboy.on('finish', () => {
            console.log('Form parsing compvared');
            console.log(fields);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${company_name.toLowerCase().split(" ").join("_")}_techpack_v${fields["verTechpack"]}.pdf"`);
            techpackGenerator(fields, files, console, res);

        });

        req.pipe(busboy);

    } else {
        res.writeHead(404);
        res.end();
    }

});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});


// add svg conversion function to PDFdoc
PDFdoc.prototype.addSVG = function (svg, x, y, options) {
    return SVGtoPDF(this, svg, x, y, options), this;
};

async function techpackGenerator(fields, files, console, res) {

    // create and pipe the pdf to a blob
    const techpack = new PDFdoc({ autoFirstPage: false });
    const stream = techpack.pipe(blobStream());
    console.log("PDF file initialized");

    // pipe to response
    techpack.pipe(res);

    // enable form
    techpack.initForm();

    // generate each page in the techpack
    for (let i = 0; i < parseInt(fields["numMockups"][0]); i++) {

        // generate page size based on number of views
        const key_view = `views${i + 1}[]`;
        const num_views = fields[key_view].length;
        const page_width = 600 + 1000 * num_views;
        techpack.addPage({
            size: [page_width, 1650]
        })
        techpack
            .rect(0, 0, page_width, 1650)
            .fill("#F5F5F5");
        console.log("Page", i, "added");

        // STUDSON logo
        const studson_logo_path = '../assets/logos/studson_logo.svg';
        const studson_logo = fs.readFileSync(studson_logo_path, "utf8");
        techpack.addSVG(studson_logo, 50, 75, {
            width: 600,
            height: 105,
        });

        // CUSTOM BRANDING
        techpack
            .font("../assets/fonts/Cantarell-Bold.ttf")
            .fillColor("#000000")
            .fontSize("50")
            .text("CUSTOM BRANDING", 50, 200, {
                align: "center",
                width: 600
            });

        // TOP INFO/OPTIONS
        const key_model = `helmetModel${i + 1}`;
        const key_class = `helmetClass${i + 1}`;
        const key_color = `helmetColor${i + 1}`;
        const key_sticker = `helmetSticker${i + 1}`;

        techpack
            .font("../assets/fonts/Cantarell-Regular.ttf")
            .fillColor("#000000")
            .fontSize(30)
            .text("DATE:\nCUSTOMER:\nHELMET STYLE:\nCOLOR:\nCERTIFICATIONS:\nVERSION", 675, 50)
            .text(`${getDate()}\n${fields["companyName"]}\nSHK-1 ${fields[key_model]} ${fields[key_class]}\n${fields[key_color]}\nANSI Z89.1 - 2014 TYPE II\n${getVersion(fields["verTechpack"][0])}`, 975, 50);

        // Generate each view's mockup
        let view_num = 0;
        let sticker = fields[key_sticker][0];


        for (let view of fields[key_view]) {
            // Warp logo and composite on helmet
            const key_logo_file = `logo${i + 1}_${view}`;
            const logo_path = `../assets/temp/${view}_logo_${i}.png`;
            const mockup_path = `../assets/temp/${view}_mockup_${i}.png`;
            const key_width = `logoWidth${i + 1}_${view}`;
            const key_shift = `logoShift${i + 1}_${view}`;
            const key_pms = `pmsColor${i + 1}_${view}[]`;
            const key_shortcut = `logoType${i + 1}_${view}`;

            // bool to control whether a logo is placed or not
            let blank = false;

            // update logo buffer, width, shift, and pms colors/code as necessary based on logo type
            switch (fields[key_shortcut][0]) {
                case "New Logo":
                    break;
                
                case "Blank":
                    blank = true;
                    files[key_logo_file] = "NULL";
                    fields[key_width] = "NULL";
                    fields[key_shift] = "NULL";
                    fields[key_pms] = "NULL";
                    files[key_logo_file] = {filename: {filename: "NULL"}};
                    files[key_logo_file].filename["filename"] = "NULL";
                    break;

                case "Same Logo (as previous)":
                    files[key_logo_file] = files[`logo${i}_${view}`];
                    fields[key_width] = fields[`logoWidth${i}_${view}`];
                    fields[key_shift] = fields[`logoShift${i}_${view}`];
                    fields[key_pms] = fields[`pmsColor${i}_${view}[]`]
                    break;

                case "American Flag":
                    files[key_logo_file] = {buffer: "../assets/logos/american_white.svg" }; // Store buffer and metadata
                    fields[key_pms] = ["187,A6192E", "5265,403A60", "WHITE,FFFFFF"];
                    files[key_logo_file].filename = {"filename": "svg"};
                    break;

                case "American Flag (transparent)":
                    files[key_logo_file] = {buffer: "../assets/logos/american.svg" }; // Store buffer and metadata
                    fields[key_pms] = ["187,A6192E", "5265,403A60"];
                    files[key_logo_file].filename = {"filename": "svg"};
                    break;

                case "American Flag (reverse)":
                    files[key_logo_file] = {buffer: "../assets/logos/american_white_reverse.svg" }; // Store buffer and metadata
                    fields[key_pms] = ["187,A6192E", "5265,403A60", "WHITE,FFFFFF"];
                    files[key_logo_file].filename = {"filename": "svg"};
                    break;

                case "American Flag (transparent) (reverse)":
                    files[key_logo_file] = {buffer: "../assets/logos/american_reverse.svg" }; // Store buffer and metadata
                    fields[key_pms] = ["187,A6192E", "5265,403A60"];
                    files[key_logo_file].filename = {"filename": "svg"};
                    break;

                default:
                    console.log("Unknown logo type...exiting");
                    return;
            }

            const paths = generatePath(fields[key_model], fields[key_class], fields[key_color], view, sticker, blank);
            await generateMockup(fields[key_model], view, paths, logo_path, mockup_path, files[key_logo_file].buffer, Number(fields[key_width]), Number(fields[key_shift]), files[key_logo_file].filename["filename"], sticker, blank, console);

            // place render
            const render_height = ((["Front", "Back"].includes(view)) ? 1200 : 1050);
            const render_placement_y = ((["Front", "Back"].includes(view)) ? 300 : 375);

            techpack.image(mockup_path, 100 + view_num * 1000, render_placement_y, {
                fit: [1400, render_height],
                align: "center",
            });
            techpack
                .font("../assets/fonts/Cantarell-Bold.ttf")
                .fontSize(30)
                .fillColor([0, 0, 0, 100])
                .text(`${view}`, 300 + view_num * 1000, 1000, {
                    width: 1000,
                    align: "center"
                });

            // Place logo with dimensions and colors...
            //      NOTE: Anchor is top right corner of the first square
            //      and that the dimesion line for the logo is 350pt below the anchor

            // Logo PMS colors
            const x = view_num * 1000 + ((fields[key_view].length == 1) ? 100 : 300);
            const y = 1100;
            let pms_colors = fields[key_pms];

            if (typeof pms_colors !== 'undefined' & !blank) {
                for (let index = 0; index < pms_colors.length; index++) {
                    // square
                    techpack
                        .fillColor(`#${pms_colors[index].split(",")[1]}`)
                        .rect(x, y + 75 * index, 50, 50)
                        .fill();
                    // text
                    let color_name = pms_colors[index].split(",")[0];
                    color_name = (isNaN(parseInt(color_name[0]))) ? `${color_name} C` : `PMS ${color_name}`;
                    techpack
                        .font("../assets/fonts/Cantarell-Regular.ttf")
                        .fontSize(30)
                        .fillColor([0, 100, 0, 0])
                        .text(`${color_name}`, x + 75, y + 25 + 75 * index, {
                            baseline: "middle",
                        });
                }
            }

            // Dimensioned logo
            let filetype = files[key_logo_file]["filename"]["filename"].split(".").pop();
            let dim_width = 0;
            if (filetype=="svg" & !blank) {
                const logo = await loadImage(logo_path);
                const scale = Math.min(400 / logo.width, 300 / logo.height);
                dim_width = logo.width*scale;
                techpack.image(logo_path, x + 400, y, {
                    valign: "bottom",
                    fit: [400, 300]
                });
            } else if (!blank) {
                dim_width = 400;
                techpack
                .font("../assets/fonts/Cantarell-Regular.ttf")
                .fontSize(30)
                .fillColor([0, 100, 0, 0])
                .text(`VECTOR FILE NEEDED`, x + 400, y + 200, {
                    align: "center",
                    width: 400
                })
            }

            // logo dimensions
            if (!blank) {
                techpack
                    .strokeColor([0, 100, 0, 0])
                    .lineWidth(2)
                    .moveTo(x + 400, y + 325)
                    .lineTo(x + 400, y + 350)
                    .lineTo(x + 400 + dim_width, y + 350)
                    .lineTo(x + 400 + dim_width, y + 325)
                    .stroke();
                techpack
                    .font("../assets/fonts/Cantarell-Regular.ttf")
                    .fontSize(30)
                    .fillColor([0, 100, 0, 0])
                    .text(`${fields[key_width]} in`, x + 400, y + 375, {
                        align: "center",
                        width: dim_width
                    })
                }

            // increment view number
            view_num = view_num + 1;
        }

        // Divider line
        techpack
            .lineWidth(2)
            .strokeColor([0, 100, 0, 0])
            .moveTo(100, 1050)
            .lineTo(page_width - 100, 1050)
            .stroke();
        techpack
            .font("../assets/fonts/Cantarell-Regular.ttf")
            .fontSize(20)
            .fillColor([0, 100, 0, 0])
            .text("FINAL ARTWORK AT 100% ACTUAL SIZE", 100, 1050);

        // Signature box
        const signature_x = ((num_views == 1) ? 1000 : 1700);
        const signature_y = ((num_views == 1) ? 1350 : 50);
        techpack
            .strokeColor([0, 0, 0, 100])
            .lineWidth(1)
            .rect(signature_x, signature_y, 500, 150)
            .moveTo(signature_x + 20, signature_y + 130)
            .lineTo(signature_x + 345, signature_y + 130)
            .moveTo(signature_x + 355, signature_y + 130)
            .lineTo(signature_x + 480, signature_y + 130)
            .stroke();
        techpack
            .font("../assets/fonts/Cantarell-Bold.ttf")
            .fontSize(10)
            .fillColor([0, 0, 0, 100])
            .text("SIGNATURE FOR APPROVAL", signature_x + 20, signature_y + 132, {
                align: "center",
                width: 345 - 20
            })
            .text("DATE", signature_x + 355, signature_y + 132, {
                align: "center",
                width: 480 - 355
            })
        techpack.formText(`Approval Signature ${i}`, signature_x + 20, signature_y + 68, 345 - 20, 60, {
                    align: "center",
                    required: true,
                    backgroundColor: "#FFFFFF",
                })
                .formText(`Date ${i}`, signature_x + 355, signature_y + 68, 480 - 355, 60, {
                    align: "center",
                    required: true,
                    backgroundColor: "#FFFFFF",
                    format: "mm/dd/yy",
                })
                
    }
    
    await fs.readdir("../assets/temp", (err, files) => {
        for (let file of files) {
            fs.unlink(`../assets/temp/${file}`, (err) => {
                if (err) throw err;
            });
        }
    });
    
    techpack.end();

    // return date string in format mm/dd/yyyy
    function getDate() {
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
        const yyyy = today.getFullYear();
        return mm + '/' + dd + '/' + yyyy;
    }

    // return version string in format TPYYYY-MMDD-#
    function getVersion(version) {
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
        const yyyy = today.getFullYear();
        return 'TP' + yyyy + '-' + mm + dd + '-' + version;
    }

    // generate the path to a given render provided helmet model, class, color, and view
    // format for filename is <FB/SB>_<C/E>_<CamelCaseColor>_<F/L/R/B>
    // NOTE: there are only class C renders for the back since they are not different from class E renders
    function generatePath(helmet_model, helmet_class, helmet_color, helmet_view, sticker, blank) {
        
        let folder = "../assets/renders";
        if (helmet_view == "Back") {
            path = `${folder}/${(helmet_model == "Standard Brim") ? "SB" : "FB"}_C_${helmet_color}_${Array.from(helmet_view)[0]}.png`;
        } else {
            path = `${folder}/${(helmet_model == "Standard Brim") ? "SB" : "FB"}_${(helmet_class == "Vented Class C") ? "C" : "E"}_${helmet_color}_${Array.from(helmet_view)[0]}.png`;
        }
        sticker_path = `${folder}/Reflective_${sticker}_${(helmet_model == "Standard Brim") ? "SB" : "FB"}_${Array.from(helmet_view)[0]}${(blank) ? "_Blank" : ""}.png`;

        return {
            helmet: path,
            sticker: sticker_path,
        };
    }

    // place a logo on a render
    async function generateMockup(model, view, paths, logo_path, mockup_path, logo_buffer, width, shift, filename, sticker, blank, console) {

        // add helmet render
        const helmet = await loadImage(paths.helmet);
        const canvas = createCanvas(helmet.width, helmet.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(helmet, 0, 0);

        // add stickers as needed
        switch (sticker) {
            case "None":
                break;
            
            case "Grey":
            case "Flash":
                const sticker = await loadImage(paths.sticker);
                ctx.drawImage(sticker, 0, 0);
                break;
        }

        let base_height;
        let center_offset;
        let scaler;

        let logo;
        let logoWidth;
        let logoHeight;
        let curveHeight;

        // skip logo if helmet should be blank
        if (blank) {
            // Save the result, downscaling for smaller file size
            const buffer = canvas.toBuffer('image/png');
            await sharp(buffer)
                .resize(2500, 2500, {fit: "inside"}) 
                .png() 
                .toFile(mockup_path);
            return;
        }

        switch (view) {
            case "Front":
                // logo location and scale
                if (model == "Standard Brim") {
                    base_height = 2870;
                    center_offset = 3900;
                } else {
                    base_height = 2900;
                    center_offset = 3900;
                }
                scaler = 492; // pixels per inch

                let filetype = filename.split(".").pop();
                if (filetype=="svg") {
                    // Convert SVG to PNG
                    await sharp((typeof logo_buffer == "string") ? logo_buffer : Buffer.from(logo_buffer))
                        .resize(Math.round(width * scaler), Math.round(5 * width * scaler), { fit: "inside" }) // fit WIDTH only to provided width (5x limit on height)
                        .png() // Convert to PNG format
                        .toFile(logo_path); // Save to specified file path
                    logo = await loadImage(logo_path);
                } else {
                    // resize PNG
                    await sharp(logo_buffer)
                        .resize(Math.round(width * scaler), Math.round(5 * width * scaler), { fit: "inside" }) // fit WIDTH only to provided width (5x limit on height)
                        .png() // Convert to PNG format
                        .toFile(logo_path); // Save to specified file path
                    logo = await loadImage(logo_path);
                }

                // Simulate curved warping
                logoWidth = logo.width;
                logoHeight = logo.height;
                curveHeight = -logo.height * .005; // concave down
                
                for (let x = 0; x < logoWidth; x++) {
                    yOffset = Math.sin((x / logoWidth) * Math.PI) * curveHeight;  // curve logo
                    slice_x = Math.round(center_offset - logo.width / 2 + x);                   // center shifted back half the distnace of the logo written left to right
                    slice_y = Math.round(base_height - yOffset - logo.height - shift * scaler); // base height shifted (- offset = down | + offset = up) and written top to bottom (shift from base to top of logo)
                    ctx.drawImage(
                        logo,
                        x, 0, 1, logoHeight,       // Source: slice 1px wide
                        slice_x, slice_y, 1, logoHeight // Destination: warp along the curve
                    );
                }
                break;

            case "Left":
                // logo location and scale
                if (model == "Standard Brim") {
                    center_y = 660;
                    center_x = 1780;
                    scaler = 300; // pixels per inch
                } else {
                    center_y = 780;
                    center_x = 1730;
                    scaler = 285; // pixels per inch
                }

                // Convert SVG to PNG
                await sharp((typeof logo_buffer == "string") ? logo_buffer : Buffer.from(logo_buffer))
                    .resize(Math.round(width * scaler), Math.round(5 * width * scaler), { fit: "inside" }) // fit WIDTH only to provided width (5x limit on height)
                    .png() // Convert to PNG format
                    .toFile(logo_path); // Save to specified file path
                logo = await loadImage(logo_path);

                // Simulate curved warping and vertical compression
                logoWidth = logo.width;
                logoHeight = logo.height;
                curveHeight = 20; // concave down
                compression = .65;
                
                for (let x = 0; x < logoWidth; x++) {
                    yOffset = Math.sin((x / (logoWidth)) * Math.PI) * curveHeight;                // curve logo
                    slice_x = Math.round(center_x - logo.width / 2 + x);                          // center shifted back half the distnace of the logo written left to right
                    slice_y = Math.round(center_y - yOffset - logo.height / 2 - shift * scaler);    // center shifted (- offset = down | + offset = up) and written top to bottom (shift from base to top of logo)
                    ctx.drawImage(
                        logo,
                        x, 0, 1, logoHeight,       // Source: slice 1px wide
                        slice_x, slice_y, 1, logoHeight * compression // Destination: warp along the curve
                    );
                }
                break;

            case "Right":
                // logo location and scale
                if (model == "Standard Brim") {
                    center_y = 660;
                    center_x = 1580;
                    scaler = 300; // pixels per inch
                } else {
                    center_y = 790;
                    center_x = 1560;
                    scaler = 285; // pixels per inch
                }

                // Convert SVG to PNG
                await sharp((typeof logo_buffer == "string") ? logo_buffer : Buffer.from(logo_buffer))
                    .resize(Math.round(width * scaler), Math.round(5 * width * scaler), { fit: "inside" }) // fit WIDTH only to provided width (5x limit on height)
                    .png() // Convert to PNG format
                    .toFile(logo_path); // Save to specified file path
                logo = await loadImage(logo_path);

                // Simulate curved warping and vertical compression
                logoWidth = logo.width;
                logoHeight = logo.height;
                curveHeight = 20; // concave down
                compression = .65;

                for (let x = 0; x < logoWidth; x++) {
                    yOffset = Math.sin((x / (logoWidth)) * Math.PI) * curveHeight;                // curve logo
                    slice_x = Math.round(center_x - logo.width / 2 + x);                          // center shifted back half the distnace of the logo written left to right
                    slice_y = Math.round(center_y - yOffset - logo.height / 2 - shift * scaler);    // center shifted (- offset = down | + offset = up) and written top to bottom (shift from base to top of logo)
                    ctx.drawImage(
                        logo,
                        x, 0, 1, logoHeight,       // Source: slice 1px wide
                        slice_x, slice_y, 1, logoHeight * compression // Destination: warp along the curve
                    );
                }
                break;

            case "Back":
                // logo location and scale
                if (model == "Standard Brim") {
                    center_y = 2250;
                    center_x = 3920;
                    scaler = 540; // pixels per inch
                } else {
                    center_y = 2290;
                    center_x = 3890;
                    scaler = 560; // pixels per inch
                }
                // Convert SVG to PNG
                await sharp((typeof logo_buffer == "string") ? logo_buffer : Buffer.from(logo_buffer))
                    .resize(Math.round(width * scaler), Math.round(5 * width * scaler), { fit: "inside" }) // fit WIDTH only to provided width (5x limit on height)
                    .png() // Convert to PNG format
                    .toFile(logo_path); // Save to specified file path
                logo = await loadImage(logo_path);

                // Simulate curved warping
                logoWidth = logo.width;
                logoHeight = logo.height;
                curveHeight = -logo.height * 0; // no curve

                for (let x = 0; x < logoWidth; x++) {
                    yOffset = Math.sin((x / logoWidth) * Math.PI) * curveHeight;  // curve logo
                    slice_x = Math.round(center_x - logo.width / 2 + x);                   // center shifted back half the distnace of the logo written left to right
                    slice_y = Math.round(center_y - yOffset - logo.height / 2 - shift * scaler); // center shifted (- offset = down | + offset = up) and written top to bottom (shift from base to top of logo)
                    ctx.drawImage(
                        logo,
                        x, 0, 1, logoHeight,       // Source: slice 1px wide
                        slice_x, slice_y, 1, logoHeight // Destination: warp along the curve
                    );
                }
                break;

            default:
                console.log("Unknow view provided: not in {Front, Left, Right, Back}");
        }

        // Save the result, downscaling for smaller file size
        const buffer = canvas.toBuffer('image/png');
        await sharp(buffer)
            .resize(2500, 2500, {fit: "inside"}) 
            .png() 
            .toFile(mockup_path);
    }
}