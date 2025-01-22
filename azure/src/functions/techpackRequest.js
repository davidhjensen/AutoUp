const { app } = require('@azure/functions');

app.http('techpackRequest', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        const fields = {};
        const files = {};


        const boundary = request.headers.get("content-type").split("boundary=")[1];
        context.log("boundary read");

        const input = (await request.text());
        context.log("raw text read");

        context.log(input.split(boundary));

        /*
        const formData = await request.formData();
        formData.entries().forEach(element => {
            context.log(element);
            if (fields[element[0]] != null) {
                fields[element[0]].push(element[1]);
            } else {
                fields[element[0]] = [element[1]];
            }
            if (element[0]=="companyName") {
                company_name = element[1];
            }
        });
        */
        
        return { body: `Hello!` };
    }
});
