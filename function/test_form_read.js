const Busboy = require('busboy');
const http = require('http');
const fs = require("fs");
const PDFdoc = require("pdfkit");
const { createCanvas, loadImage } = require('canvas');
const SVGtoPDF = require('svg-to-pdfkit');
const sharp = require('sharp');
const { timeStamp } = require("console");
var blobStream = require('blob-stream');

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
            console.log('Form parsing completed');
            console.log(fields);
            techpackGenerator(fields, files, console);

        });


        // return completed techpack
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
PDFdoc.prototype.addSVG = function(svg, x, y, options) {
    return SVGtoPDF(this, svg, x, y, options), this;
};

async function techpackGenerator(fields, files, console) {
    
    // create and pipe the pdf to a blob
    const techpack = new PDFdoc();
    const stream = techpack.pipe(blobStream());
    console.log("PDF file initialized");
    
    // pipe to a .pdf file
    techpack.pipe(fs.createWriteStream('techpack.pdf'));

    // generate each page in the techpack
    for (let i = 0; i < parseInt(fields["numMockups"][0]); i++) {

        // generate page size based on number of views
        let key_view = `views${i+1}[]`;
        let num_views = fields[key_view].length;
        techpack.addPage({
            size: [400 + 1300*num_views, 2200]
        })
        console.log("Page", i, "added");

        // STUDSON logo
        const studson_logo_path = '../assets/logos/studson_logo.svg';
        const studson_logo = fs.readFileSync(studson_logo_path, "utf8");
        techpack.addSVG(studson_logo, 100, 50, {
            width: 600,
            height: 105,
        });
        
        // CUSTOM BRANDING
        techpack
            .font("../assets/fonts/Cantarell-Bold.ttf")
            .fontSize("50")
            .text("CUSTOM BRANDING", 100, 175, {
                align: "center",
                width: 600
        });

        // TOP INFO/OPTIONS
        let key_model = `helmetModel${i+1}`;
        let key_class = `helmetClass${i+1}`;
        let key_color = `helmetColor${i+1}`;
        techpack
            .font("../assets/fonts/Cantarell-Regular.ttf")
            .fontSize(30)
            .text("DATE:\nCUSTOMER:\nHELMET STYLE:\nCOLOR:\nCERTIFICATIONS:", 800, 50)
            .text(`${getDate()}\n${fields["companyName"]}\nSHK-1 ${fields[key_model]} ${fields[key_class]}\n${fields[key_color]}\nANSI Z89.1 - 2014 TYPE II`, 1100, 50);

        // Generate each view's mockup
        for (const view of fields[key_view]) {
            // Warp logo and composite on helmet
            let helmet_path = generatePath(fields[key_model], fields[key_class], fields[key_color], view);
            let key_logo_file = `logo${i+1}_${view}`;
            let logo_path = `../assets/temp/${view}_logo.png`;
            let mockup_path = `../assets/temp/${view}_mockup.png`;
            let key_width = `logoWidth${i+1}_${view}`;
            let key_shift = `logoShift${i+1}_${view}`;
            await generateMockup(fields[key_model], view, helmet_path, logo_path, mockup_path, files[key_logo_file].buffer, Number(fields[key_width]), Number(fields[key_shift]), console);

        }

        // Clear temp files
        /*
        fs.readdir("../assets/temp", (err, files) => {
            for (const file of files) {
                fs.unlink(`../assets/temp/${file}`, (err) => {
                  if (err) throw err;
                });
            }
        });
        */
    }

    techpack.end();

    // return date string in format mm/dd/yyyy
    function getDate() {
        var today = new Date();
        var dd = String(today.getDate()).padStart(2, '0');
        var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
        var yyyy = today.getFullYear();
        return mm + '/' + dd + '/' + yyyy;
    }

    // generate the path to a given render provided helmet model, class, color, and view
    function generatePath(helmet_model, helmet_class, helmet_color, helmet_view) {
        // front/back: ../assets/renders/C/Back/Full Brim Rear View_Carbon
        // left/right: ../assets/renders/C/Right/STUDSON_TechPack_FB_C_Carbon-RS.png
        let path = "../assets/renders/";
        
        if(helmet_view=="Front") {
            path = path + ((helmet_class=="Vented Class C") ? "C/" : "E/");
            path = path + helmet_view + "/";
            if(helmet_class=="Vented Class C") {
                path = path + helmet_model + " ";
                path = path + ((helmet_view=="Back") ? "Rear View_" : "Front View_");
                path = path + helmet_color + ".png";
            } else {
                path = path + helmet_model + "_TechPack ";
                path = path + ((helmet_view=="Back") ? "Rear View_" : "Front View_");
                path = path + helmet_color + "_";
                path = path + ((helmet_class=="Vented Class C") ? "C.png" : "E.png");
            }
        } else if(helmet_view=="Back") {
            path = path + "C/";
            path = path + helmet_view + "/";
            path = path + helmet_model + " ";
            path = path + ((helmet_view=="Back") ? "Rear View_" : "Front View_");
            path = path + helmet_color + ".png";
        } else {
            path = path + ((helmet_view=="Left") ? "Left Side/" : "Right Side/");
            path = path + "STUDSON_TechPack_";
            path = path + ((helmet_model=="Standard Brim") ? "SB_" : "FB_");
            path = path + ((helmet_class=="Vented Class C") ? "C_" : "E_");
            path = path + helmet_color + ".png";
        }
        console.log(path);
        return path;
    }

    // place a logo on
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

        switch(view) {
            case "Front":
                // logo location and scale
                if(model=="Standard Brim") {
                    base_height = 2870;
                    center_offset = 3900;
                } else {
                    base_height = 2900;
                    center_offset = 3900;
                }
                scaler = 492; // pixels per inch

                // Convert SVG to PNG
                await sharp(Buffer.from(logo_buffer))
                    .resize(Math.round(width*scaler), Math.round(5*width*scaler), {fit: "inside"}) // fit WIDTH only to provided width (5x limit on height)
                    .png() // Convert to PNG format
                    .toFile(logo_path); // Save to specified file path
                logo = await loadImage(logo_path);

                // Simulate curved warping
                logoWidth = logo.width;
                logoHeight = logo.height;
                curveHeight = -logo.height*.005; // concave down
            
                for (let x = 0; x < logoWidth; x++) {
                    yOffset = Math.sin((x / logoWidth) * Math.PI) * curveHeight;  // curve logo
                    slice_x = Math.round(center_offset - logo.width/2 + x);                   // center shifted back half the distnace of the logo written left to right
                    slice_y = Math.round(base_height - yOffset - logo.height - shift*scaler); // base height shifted (- offset = down | + offset = up) and written top to bottom (shift from base to top of logo)
                    ctx.drawImage(
                        logo,
                        x, 0, 1, logoHeight,       // Source: slice 1px wide
                        slice_x, slice_y, 1, logoHeight // Destination: warp along the curve
                    );
                }
                break;

            case "Left":
                // logo location and scale
                if(model=="Standard Brim") {
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
                    .resize(Math.round(width*scaler), Math.round(5*width*scaler), {fit: "inside"}) // fit WIDTH only to provided width (5x limit on height)
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
                    slice_x = Math.round(center_x - logo.width/2 + x);                          // center shifted back half the distnace of the logo written left to right
                    slice_y = Math.round(center_y - yOffset - logo.height/2 - shift*scaler);    // center shifted (- offset = down | + offset = up) and written top to bottom (shift from base to top of logo)
                    ctx.drawImage(
                        logo,
                        x, 0, 1, logoHeight,       // Source: slice 1px wide
                        slice_x, slice_y, 1, logoHeight*compression // Destination: warp along the curve
                    );
                }
                break;

            case "Right":
                
                break;

            case "Back":
                // logo location and scale
                if(model=="Standard Brim") {
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
                    .resize(Math.round(width*scaler), Math.round(5*width*scaler), {fit: "inside"}) // fit WIDTH only to provided width (5x limit on height)
                    .png() // Convert to PNG format
                    .toFile(logo_path); // Save to specified file path
                logo = await loadImage(logo_path);

                // Simulate curved warping
                logoWidth = logo.width;
                logoHeight = logo.height;
                curveHeight = -logo.height*0; // no curve
            
                for (let x = 0; x < logoWidth; x++) {
                    yOffset = Math.sin((x / logoWidth) * Math.PI) * curveHeight;  // curve logo
                    slice_x = Math.round(center_x - logo.width/2 + x);                   // center shifted back half the distnace of the logo written left to right
                    slice_y = Math.round(center_y - yOffset - logo.height/2 - shift*scaler); // center shifted (- offset = down | + offset = up) and written top to bottom (shift from base to top of logo)
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
/*





const helmet = await loadImage(helmet_path);
        const logo = await loadImage(logo_path);
      
        // Create a canvas
        const canvas = createCanvas(helmet.width, helmet.height);
        const ctx = canvas.getContext('2d');
      
        // Draw the helmet
        ctx.drawImage(helmet, 0, 0);
      
        // Simulate curved warping
        const logoWidth = logo.width;
        const logoHeight = logo.height;
        const curveHeight = -logo.height*.04; // concave down
      
        // logo location
        const base_height = 550;
        const center_offset = 360;
      
        for (let x = 0; x < logoWidth; x++) {
            const yOffset = Math.sin((x / logoWidth) * Math.PI) * curveHeight + (x)/logoWidth*20; // Adjust the curve
            ctx.drawImage(
                logo,
                x, 0, 1, logoHeight,       // Source: slice 1px wide
                center_offset + (helmet.width-logo.width)/2 + x, base_height - yOffset, 1, logoHeight // Destination: warp along the curve
            );
        }
      
        // Save the result
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(output_path, buffer);












function SingleMockup(company, model, color, certifications, view, PMS1, PMS2, PMS3, PMS4) {
    this.company = company;
    this.model = model;
    this.color = color;
    this.certifications = certifications;
    this.view = view;
    this.PMS = [PMS1, PMS2, PMS3, PMS4];
    this.logo_width = 3.25;

    this.generateTechpack = async function() {
        this.techpack = new PDFdoc({
            size: [1800, 2200]
        });
        this.techpack.pipe(fs.createWriteStream('techpack.pdf'));

        // STUDSON logo
        const studson_logo_path = './american.svg';
        const studson_logo = fs.readFileSync(studson_logo_path, "utf8");
        this.techpack.addSVG(studson_logo, 100, 50, {
            width: 600,
            height: 105,
        });

        // CUSTOM BRANDING
        this.techpack
            .font("./fonts/Cantarell-Bold.ttf")
            .fontSize("50")
            .text("CUSTOM BRANDING", 100, 175, {
                align: "center",
                width: 600
            })

        // TOP INFO/OPTIONS
        this.techpack
            .font("./fonts/Cantarell-Regular.ttf")
            .fontSize(30)
            .text("DATE:\nCUSTOMER:\nHELMET STYLE:\nCOLOR:\nCERTIFICATIONS:", 800, 50)
            .text(`${this.getDate()}\n${this.company}\n${this.model}\n${this.color}\n${this.certifications}`, 1100, 50);

        // Warp logo and composite on helmet
        let helmet_path = "./helmet_renders/fb_back.png";
        let logo_path = `./temp/${this.view}_logo.png`;
        let mockup_path = `./temp/${this.view}_mockup.png`;
        // Convert SVG to PNG
        await sharp(Buffer.from(studson_logo))
            .resize(180, 180, {fit: "inside"})  // 2000=front full width
                                                // 180=back full width
            .png() // Convert to PNG format
            .toFile(logo_path); // Save to specified file path
        
        await this.backWarpFB(helmet_path, logo_path, mockup_path);

        // Insert helmet mockup
        this.techpack.image(mockup_path, 0, 300, {
            fit: [1800, 1200],
            align: "center",
        });
        this.techpack
            .font("./fonts/Cantarell-Bold.ttf")
            .fontSize(30)
            .fillColor([0,0,0,100])
            .text(`${this.view}`, 0, 1505, {
                align: "center"
            });
        

        this.dividerLine(1800);

        this.logoSpec(100, 1700, this.PMS, logo_path);

        this.approvalBox(1100, 1900);

        this.techpack.end();
        return "Techpack Generated";

    }

    this.getDate = function() {
        var today = new Date();
        var dd = String(today.getDate()).padStart(2, '0');
        var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
        var yyyy = today.getFullYear();
        return mm + '/' + dd + '/' + yyyy;
    }

    this.dividerLine = function(doc_width) {
        this.techpack
            .lineWidth(2)
            .strokeColor([0, 100, 0, 0])
            .moveTo(100, 1550)
            .lineTo(doc_width - 100, 1550)
            .stroke();
        this.techpack
            .font("./fonts/Cantarell-Regular.ttf")
            .fontSize(20)
            .fillColor([0,100,0,0])
            .text("FINAL ARTWORK AT 100% ACTUAL SIZE", 100, 1555);
    }

    this.logoSpec = function(x, y, PMS, logo_path) {
        // Anchor is top right corner of the first square
        // Note that the dimesion line for the logo is 350pt
        // below the anchor

        // PMS colors
        for (let index = 0; index < 4; index++) {
            // square
            this.techpack
                .fillColor(PMS[index][1])
                .rect(x, y + 75*index, 50, 50)
                .fill();
            // text
            this.techpack
                .font("./fonts/Cantarell-Regular.ttf")
                .fontSize(30)
                .fillColor([0,100,0,0])
                .text(`${PMS[index][0]}`, x + 75, y + 25 + 75*index, {
                    baseline: "middle",
                });
        }

        // Dimensioned logo
        this.techpack.image(logo_path, x + 400, y - 100, {
            valign: "bottom",
            fit: [400, 400]
        });

        // logo dimensions
        this.techpack
            .strokeColor([0,100,0,0])
            .lineWidth(2)
            .moveTo(x + 400, y + 325)
            .lineTo(x + 400, y + 350)
            .lineTo(x + 800, y + 350)
            .lineTo(x + 800, y + 325)
            .stroke();
        this.techpack
            .font("./fonts/Cantarell-Regular.ttf")
            .fontSize(30)
            .fillColor([0,100,0,0])
            .text(`${this.logo_width} in`, x + 400, y + 375, {
                align: "center",
                width: 400
            })
    }

    this.approvalBox = function(x, y) {
        // anchor is top right corner
        // note that the bottom is 150pt 
        // below the anchor

        // box
        this.techpack
            .strokeColor([0,0,0,100])
            .lineWidth(1)
            .rect(x, y, 600, 150)
            .moveTo(x+20, y+130)
            .lineTo(x+395, y+130)
            .moveTo(x+405, y+130)
            .lineTo(x+580, y+130)
            .stroke();
        // text   
        this.techpack
            .font("./fonts/Cantarell-Bold.ttf")
            .fontSize(10)
            .fillColor([0,0,0,100])
            .text("SIGNATURE FOR APPROVAL", x+20, y+132, {
                align: "center",
                width: 395-20
            })
            .text("DATE", x+405, y+132, {
                align: "center",
                width: 580-405
            })
    }

    this.frontWarpHB = async function(helmet_path, logo_path, output_path) {
        const helmet = await loadImage(helmet_path);
        const logo = await loadImage(logo_path);
      
        // Create a canvas
        const canvas = createCanvas(helmet.width, helmet.height);
        const ctx = canvas.getContext('2d');
      
        // Draw the helmet
        ctx.drawImage(helmet, 0, 0);
      
        // Simulate curved warping
        const logoWidth = logo.width;
        const logoHeight = logo.height;
        const curveHeight = -logo.height*0.05; // concave up
      
        // logo location
        const base_height = 2500;
        const center_offset = -100;
      
        for (let x = 0; x < logoWidth; x++) {
            const yOffset = Math.sin((x / logoWidth) * Math.PI) * curveHeight; // Adjust the curve
            ctx.drawImage(
                logo,
                x, 0, 1, logoHeight,       // Source: slice 1px wide
                center_offset + (helmet.width-logo.width)/2 + x, base_height - yOffset, 1, logoHeight // Destination: warp along the curve
            );
        }
      
        // Save the result
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(output_path, buffer);
    }

    this.leftWarpHB = async function(helmet_path, logo_path, output_path) {
        const helmet = await loadImage(helmet_path);
        const logo = await loadImage(logo_path);
      
        // Create a canvas
        const canvas = createCanvas(helmet.width, helmet.height);
        const ctx = canvas.getContext('2d');
      
        // Draw the helmet
        ctx.drawImage(helmet, 0, 0);
      
        // Simulate curved warping
        const logoWidth = logo.width;
        const logoHeight = logo.height;
        const curveHeight = logo.height*0.2; // concave down
      
        // logo location
        const base_height = 600;
        const center_offset = 100;
      
        for (let x = 0; x < logoWidth; x++) {
            const yOffset = Math.sin((x / logoWidth) * Math.PI) * curveHeight + (x)/logoWidth*100; // Adjust the curve
            ctx.drawImage(
                logo,
                x, 0, 1, logoHeight,       // Source: slice 1px wide
                center_offset + (helmet.width-logo.width)/2 + x, base_height - yOffset, 1, logoHeight // Destination: warp along the curve
            );
        }
      
        // Save the result
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(output_path, buffer);
    }

    this.leftWarpFB = async function(helmet_path, logo_path, output_path) {
        const helmet = await loadImage(helmet_path);
        const logo = await loadImage(logo_path);
      
        // Create a canvas
        const canvas = createCanvas(helmet.width, helmet.height);
        const ctx = canvas.getContext('2d');
      
        // Draw the helmet
        ctx.drawImage(helmet, 0, 0);
      
        // Simulate curved warping
        const logoWidth = logo.width;
        const logoHeight = logo.height;
        const curveHeight = logo.height*0.2; // concave down
      
        // logo location
        const base_height = 700;
        const center_offset = 50;
      
        for (let x = 0; x < logoWidth; x++) {
            const yOffset = Math.sin((x / logoWidth) * Math.PI) * curveHeight + (x)/logoWidth*100; // Adjust the curve
            ctx.drawImage(
                logo,
                x, 0, 1, logoHeight,       // Source: slice 1px wide
                center_offset + (helmet.width-logo.width)/2 + x, base_height - yOffset, 1, logoHeight // Destination: warp along the curve
            );
        }
      
        // Save the result
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(output_path, buffer);
    }

    this.backWarpFB = async function(helmet_path, logo_path, output_path) {
        const helmet = await loadImage(helmet_path);
        const logo = await loadImage(logo_path);
      
        // Create a canvas
        const canvas = createCanvas(helmet.width, helmet.height);
        const ctx = canvas.getContext('2d');
      
        // Draw the helmet
        ctx.drawImage(helmet, 0, 0);
      
        // Simulate curved warping
        const logoWidth = logo.width;
        const logoHeight = logo.height;
        const curveHeight = -logo.height*.04; // concave down
      
        // logo location
        const base_height = 550;
        const center_offset = 360;
      
        for (let x = 0; x < logoWidth; x++) {
            const yOffset = Math.sin((x / logoWidth) * Math.PI) * curveHeight + (x)/logoWidth*20; // Adjust the curve
            ctx.drawImage(
                logo,
                x, 0, 1, logoHeight,       // Source: slice 1px wide
                center_offset + (helmet.width-logo.width)/2 + x, base_height - yOffset, 1, logoHeight // Destination: warp along the curve
            );
        }
      
        // Save the result
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(output_path, buffer);
    }
}
*/