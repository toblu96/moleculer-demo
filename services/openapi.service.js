const Openapi = require("moleculer-auto-openapi");

module.exports = {
    name: 'openapi',
    mixins: [Openapi],
    settings: {
        // all setting optional
        openapi: {
            info: {
                // about project
                description: "Sample Swagger for all Actions",
                title: "Moleculer-Demo",
                version: "0.0.1"
            },
            tags: [
                // you tags
                { name: "openapi", description: "Default Swagger Endpoints" },
                { name: "api", description: "Default API Endpoints" },
            ],
            components: {
                // you auth
                securitySchemes: {
                    myBasicAuth: {
                        type: 'http',
                        scheme: 'basic',
                    },
                },
            },
        },
    },
}