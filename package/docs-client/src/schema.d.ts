export interface paths {
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Service is healthy */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["HealthResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/templates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Templates visible to the caller token allowlist */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TemplateCatalogResponse"];
                    };
                };
                /** @description Invalid or missing service token */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorBody"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/render": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["RenderDocumentRequest"];
                };
            };
            responses: {
                /** @description Render completed */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RenderDocumentResponse"];
                    };
                };
                /** @description Invalid payload */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorBody"];
                    };
                };
                /** @description Invalid or missing service token */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorBody"];
                    };
                };
                /** @description Template or format not allowed */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorBody"];
                    };
                };
                /** @description Template not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorBody"];
                    };
                };
                /** @description Renderer unavailable */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorBody"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        HealthResponse: {
            /** @enum {string} */
            status: "ok";
        };
        TemplateCatalogEntry: {
            key: string;
            formats: ("pdf" | "xlsx")[];
            locales: string[];
            version: string;
        };
        TemplateCatalogResponse: {
            templates: components["schemas"]["TemplateCatalogEntry"][];
        };
        ErrorBody: {
            code: string;
            message: string;
        };
        RenderArtifact: {
            objectId: string;
            downloadUrl: string;
            expiresAt: string;
        };
        RenderDocumentResponse: {
            renderId: string;
            contentType: string;
            sha256: string;
            bytesBase64?: string;
            artifact?: components["schemas"]["RenderArtifact"];
        };
        SignaturePosition: {
            page: "first" | "last" | number;
            x: number;
            y: number;
            width: number;
        };
        SignatureSlot: {
            slot: string;
            imageUrl: string;
            position: components["schemas"]["SignaturePosition"];
        };
        RenderOptions: {
            /** @enum {string} */
            paper?: "A4" | "Letter";
            /** @enum {string} */
            orientation?: "portrait" | "landscape";
            signatures?: components["schemas"]["SignatureSlot"][];
        };
        RenderDocumentRequest: {
            templateKey: string;
            /** @enum {string} */
            format: "pdf" | "xlsx";
            locale: string;
            schoolId: string;
            payload?: unknown;
            options?: components["schemas"]["RenderOptions"];
            /** @enum {string} */
            delivery: "inline" | "storage";
            idempotencyKey: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;

