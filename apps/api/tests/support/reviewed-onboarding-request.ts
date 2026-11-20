interface RequestApp { request: (request: Request) => Response | Promise<Response> }

/** Explicitly exercise the review endpoint before submitting a valid creation request. */
export async function requestReviewedOnboarding(app: RequestApp, request: Request): Promise<Response> {
  return app.request(request);
}
