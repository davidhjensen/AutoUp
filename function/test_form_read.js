const Busboy = require('busboy');
const http = require('http');
const fs = require("fs");
const PDFdoc = require("pdfkit");
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

        // read and store fields
        busboy.on('field', (fieldname, val) => {
            console.log(`Field [${fieldname}]: value: ${val}`);
            if (fields[fieldname] != null) {
                fields[fieldname].push(val);
            } else {
                fields[fieldname] = [val];
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
            techpackGenerator(fields, files, console);

        });

        // return compvared techpack
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ fields, files }));

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

async function techpackGenerator(fields, files, console) {

    // create and pipe the pdf to a blob
    const techpack = new PDFdoc({ autoFirstPage: false });
    const stream = techpack.pipe(blobStream());
    console.log("PDF file initialized");

    // pipe to a .pdf file
    techpack.pipe(fs.createWriteStream('techpack.pdf'));

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
        techpack.addSVG(studson_logo, 50, 50, {
            width: 600,
            height: 105,
        });

        // CUSTOM BRANDING
        techpack
            .font("../assets/fonts/Cantarell-Bold.ttf")
            .fontSize("50")
            .text("CUSTOM BRANDING", 50, 175, {
                align: "center",
                width: 600
            });

        // TOP INFO/OPTIONS
        const key_model = `helmetModel${i + 1}`;
        const key_class = `helmetClass${i + 1}`;
        const key_color = `helmetColor${i + 1}`;
        techpack
            .font("../assets/fonts/Cantarell-Regular.ttf")
            .fillColor("#000000")
            .fontSize(30)
            .text("DATE:\nCUSTOMER:\nHELMET STYLE:\nCOLOR:\nCERTIFICATIONS:", 675, 50)
            .text(`${getDate()}\n${fields["companyName"]}\nSHK-1 ${fields[key_model]} ${fields[key_class]}\n${fields[key_color]}\nANSI Z89.1 - 2014 TYPE II`, 975, 50);

        // Generate each view's mockup
        let view_num = 0;


        for (let view of fields[key_view]) {
            // Warp logo and composite on helmet
            const helmet_path = generatePath(fields[key_model], fields[key_class], fields[key_color], view);
            const key_shortcut = `logoType${i + 1}_${view}`;
            const logo_path = `../assets/temp/${view}_logo_${i}.png`;
            const mockup_path = `../assets/temp/${view}_mockup_${i}.png`;
            const key_width = `logoWidth${i + 1}_${view}`;
            const key_shift = `logoShift${i + 1}_${view}`;
            var key_logo_file;
            var buffer;

            switch (fields[key_shortcut][0]) {
                case "New Logo":
                    key_logo_file = `logo${i + 1}_${view}`;
                    buffer = files[key_logo_file].buffer;
                    break;

                case "Same Logo":
                    key_logo_file = `logo1_${view}`;
                    buffer = files[key_logo_file].buffer;
                    break;

                case "American Flag":
                    buffer = "../assets/logos/american_white.svg";
                    break;

                case "American Flag (transparent)":
                    buffer = "../assets/logos/american.svg";
                    break;

                default:
                    console.log("Unknown logo type...exiting");
                    return;
            }
            //console.log(buffer);
            //console.log(typeof buffer);
            await generateMockup(fields[key_model], view, helmet_path, logo_path, mockup_path, buffer, Number(fields[key_width]), Number(fields[key_shift]), console);

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
            const pms_codes = fields[`pmsCode${i + 1}_${view}[]`];
            const pms_hex = fields[`hexCode${i + 1}_${view}[]`];
            const x = view_num * 1000 + ((fields[key_view].length == 1) ? 100 : 300);
            const y = 1150;
            if (typeof pms_codes !== 'undefined') {
                for (let index = 0; index < pms_codes.length; index++) {
                    // square
                    techpack
                        .fillColor(`#${pms_hex[index]}`)
                        .rect(x, y + 75 * index, 50, 50)
                        .fill();
                    // text
                    techpack
                        .font("../assets/fonts/Cantarell-Regular.ttf")
                        .fontSize(30)
                        .fillColor([0, 100, 0, 0])
                        .text(`${pms_codes[index]}`, x + 75, y + 25 + 75 * index, {
                            baseline: "middle",
                        });
                }
            }

            // Dimensioned logo
            techpack.image(logo_path, x + 400, y - 100, {
                valign: "bottom",
                fit: [400, 400]
            });

            // logo dimensions
            techpack
                .strokeColor([0, 100, 0, 0])
                .lineWidth(2)
                .moveTo(x + 400, y + 325)
                .lineTo(x + 400, y + 350)
                .lineTo(x + 800, y + 350)
                .lineTo(x + 800, y + 325)
                .stroke();
            techpack
                .font("../assets/fonts/Cantarell-Regular.ttf")
                .fontSize(30)
                .fillColor([0, 100, 0, 0])
                .text(`${fields[key_width]} in`, x + 400, y + 375, {
                    align: "center",
                    width: 400
                })

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
            .lineTo(signature_x + 395, signature_y + 130)
            .moveTo(signature_x + 405, signature_y + 130)
            .lineTo(signature_x + 480, signature_y + 130)
            .stroke();
        techpack
            .font("../assets/fonts/Cantarell-Bold.ttf")
            .fontSize(10)
            .fillColor([0, 0, 0, 100])
            .text("SIGNATURE FOR APPROVAL", signature_x + 20, signature_y + 132, {
                align: "center",
                width: 295 - 20
            })
            .text("DATE", signature_x + 405, signature_y + 132, {
                align: "center",
                width: 380 - 305
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

    // generate the path to a given render provided helmet model, class, color, and view
    function generatePath(helmet_model, helmet_class, helmet_color, helmet_view) {
        let path = "../assets/renders/";

        if (helmet_view == "Front") {
            path = path + ((helmet_class == "Vented Class C") ? "C/" : "E/");
            path = path + helmet_view + "/";
            path = path + helmet_model + "_TechPack_Front View_";
            path = path + helmet_color;
            path = path + ((helmet_class == "Vented Class C") ? ".png" : "_E.png");
        } else if (helmet_view == "Back") {
            path = path + "C/";
            path = path + helmet_view + "/";
            path = path + helmet_model + "_TechPack_";
            path = path + ((helmet_view == "Back") ? "Rear View_" : "Front View_");
            path = path + helmet_color + ".png";
        } else if (helmet_view == "Left") {
            path = path + ((helmet_class == "Vented Class C") ? "C/" : "E/");
            path = path + ((helmet_view == "Left") ? "Left Side/" : "Right Side/");
            path = path + "STUDSON_TechPack_";
            path = path + ((helmet_model == "Standard Brim") ? "SB_" : "FB_");
            path = path + ((helmet_class == "Vented Class C") ? "C_" : "E_");
            path = path + helmet_color + ".png";
        } else {
            path = path + ((helmet_class == "Vented Class C") ? "C/" : "E/");
            path = path + ((helmet_view == "Left") ? "Left Side/" : "Right Side/");
            path = path + "STUDSON_TechPack_";
            path = path + ((helmet_model == "Standard Brim") ? "SB_" : "FB_");
            path = path + ((helmet_class == "Vented Class C") ? "C_" : "E_");
            path = path + helmet_color + "-RS.png";
        }
        return path;
    }

    // place a logo on a render
    async function generateMockup(model, view, helmet_path, logo_path, mockup_path, logo_buffer, width, shift, console) {


        const helmet = await loadImage(helmet_path);
        const canvas = createCanvas(helmet.width, helmet.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(helmet, 0, 0);

        let base_height;
        let center_offset;
        let scaler;

        let logo;
        let logoWidth;
        let logoHeight;
        let curveHeight;

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

                // Convert SVG to PNG
                await sharp((typeof logo_buffer == "string") ? logo_buffer : Buffer.from(logo_buffer))
                    .resize(Math.round(width * scaler), Math.round(5 * width * scaler), { fit: "inside" }) // fit WIDTH only to provided width (5x limit on height)
                    .png() // Convert to PNG format
                    .toFile(logo_path); // Save to specified file path
                logo = await loadImage(logo_path);

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
                await sharp(Buffer.from(logo_buffer))
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
                await sharp(Buffer.from(logo_buffer))
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
                //console.log(`height: ${base_height} | offset`);
                // Convert SVG to PNG
                await sharp(Buffer.from(logo_buffer))
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
                console.log("Unknow view provided: note in {Front, Left, Right, Back}");
        }
        // Save the result
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(mockup_path, buffer);
    }
}