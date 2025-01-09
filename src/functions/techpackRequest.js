const { app } = require('@azure/functions');
const Busboy = require('busboy');

app.http('techpackRequest', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        return new Promise((resolve, reject) => {
            context.log('Starting...');
            context.log('Request headers:', request.headers);
            context.log('Request method:', request.method);

            const busboy = Busboy({ headers: request.headers });
            const fields = {};
            const files = [];
            context.log('busboy created');

            busboy.on('field', (fieldname, val) => {
                context.log(`Field [${fieldname}]: value: ${val}`);
                fields[fieldname] = val;
            });

            busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
                context.log(`File [${fieldname}] received: ${filename}`);
                file.on('data', (data) => {
                    context.log(`File [${fieldname}] chunk received (${data.length} bytes)`);
                });
                file.on('end', () => {
                    context.log(`File [${fieldname}] finished`);
                    files.push({ fieldname, filename, mimetype });
                });
            });

            busboy.on('finish', () => {
                context.log('Form parsing completed');
            });
        });
    }
});