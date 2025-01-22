const { app } = require('@azure/functions');

app.http('techpackRequest', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        const fields = {};
        const files = {};

        const formData = await request.formData();
        formData.entries().forEach(element => {
            if (fields[element[0]] != null) {
                fields[element[0]].push(element[1]);
            } else {
                fields[element[0]] = [element[1]];
            }
            if (element[0]=="companyName") {
                company_name = element[1];
            }
        });
        context.log(fields);
        
        return { body: `Hello!` };
    }
});
