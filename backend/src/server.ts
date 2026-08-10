import express, { type NextFunction, type Request, type Response } from "express";
import { env } from "./env.js";
import { HttpError } from "./security/errors.js";
import { triggerWorkflowRun } from "./actions/triggerWorkflowRun.js";
import { approveStep } from "./actions/approveStep.js";
import { lookupUserByEmail } from "./actions/lookupUserByEmail.js";
import { triggerFromWebhook } from "./webhooks/workflowWebhook.js";
import { handleNotifyEvent } from "./webhooks/notifyEvent.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

function requireActionSecret(req: Request, _res: Response, next: NextFunction) {
  if (req.header("X-Hasura-Action-Secret") !== env.hasuraActionSecret) {
    throw new HttpError(401, "Invalid action secret");
  }
  next();
}

function requireEventSecret(req: Request, _res: Response, next: NextFunction) {
  if (req.header("X-Hasura-Event-Secret") !== env.hasuraEventSecret) {
    throw new HttpError(401, "Invalid event secret");
  }
  next();
}

// -- Hasura Actions --------------------------------------------------------
// Hasura POSTs { action: { name }, input, session_variables, request_query },
// where `input` holds every GraphQL argument keyed by its argument name.
// Both actions declare a single argument literally named `input`
// (`triggerWorkflowRun(input: TriggerWorkflowRunInput!)` in actions.graphql),
// so the actual payload we want is nested one level deeper: `req.body.input.input`.

app.post("/actions/triggerWorkflowRun", requireActionSecret, async (req, res, next) => {
  try {
    const result = await triggerWorkflowRun(req.body.input.input, req.body.session_variables ?? {});
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.post("/actions/approveStep", requireActionSecret, async (req, res, next) => {
  try {
    const result = await approveStep(req.body.input.input, req.body.session_variables ?? {});
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.post("/actions/lookupUserByEmail", requireActionSecret, async (req, res, next) => {
  try {
    const result = await lookupUserByEmail(req.body.input.input, req.body.session_variables ?? {});
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// -- Webhook trigger (spec section 24) -------------------------------------

app.post("/webhooks/:token", async (req, res, next) => {
  try {
    const result = await triggerFromWebhook(req.params.token);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// -- Hasura Event Trigger for the notify step (spec section 17.4) ---------

app.post("/events/notify", requireEventSecret, async (req, res, next) => {
  try {
    await handleNotifyEvent(req.body);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Hasura Actions/Event Triggers expect a JSON body of the shape
// { message: string } on error, surfaced back through the GraphQL response.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    if (err.status >= 500) console.error(err);
    res.status(err.status).json({ message: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

app.listen(env.port, () => {
  console.log(`Backend listening on http://localhost:${env.port}`);
});
