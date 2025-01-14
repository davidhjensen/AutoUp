const fs = require("fs");
const PDFdoc = require("pdfkit");
const { createCanvas, loadImage } = require('canvas');
const SVGtoPDF = require('svg-to-pdfkit');
const sharp = require('sharp');
const { timeStamp } = require("console");

PDFdoc.prototype.addSVG = function(svg, x, y, options) {
    return SVGtoPDF(this, svg, x, y, options), this;
};

    this.company = company;
    this.model = model;
    this.color = color;
    this.certifications = certifications;
    this.view = view;
    this.PMS = [PMS1, PMS2, PMS3, PMS4];
    this.logo_width = 3.25;

function SingleMockup() {
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


var PCL = new SingleMockup("PCL", "SHK-1 Vented Class C", "White", "ANSI Z89.1 - 2014 TYPE II", "Front", ["PMS 1234 C", [100, 0, 0, 0]], ["PMS 1234 C", [0, 100, 0, 0]]);
console.log(PCL.generateTechpack())