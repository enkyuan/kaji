# Kaji

## One-sentence definition

Kaji is an embedded execution layer that safely turns agent-requested application actions into real state changes.

## Problem

Applications already contain domain functions such as `refundPayment()`, `cancelBooking()`, `sendEmail()`, `replaceComponent()`, and `publishDesign()`.

When autonomous software can call those functions, each caller otherwise needs to solve caller identity, input validation, authorization, human approval, idempotency, cancellation and timeouts, ambiguous side effects, and execution evidence. Reimplementing that safety boundary for every tool creates inconsistent and unsafe behavior.

Kaji standardizes the boundary between a requested action and its execution. Kaji is not an agent framework, workflow engine, tool framework, integration platform, or generic orchestration system.

## Mental model

```text
agent/framework/direct caller
        ↓ proposes action
      Kaji
        ↓ governs execution
application capability
        ↓
application/external system
```

Agent frameworks decide what to do. Application code defines what an action means. Kaji owns how that action is safely executed.

## Target user

Kaji serves a backend or product engineer who adds autonomous writes or external effects to an existing application.

The typical environment has:

- a TypeScript backend
- existing domain functions
- existing authentication and authorization
- one or more agent, MCP, or automation callers
- a need to avoid reimplementing execution safety for each tool

## Core use cases

1. **Product-state mutation:** An agent requests a booking cancellation. Kaji validates the request, identifies the caller, authorizes the action, and records the outcome before application code changes the booking.
2. **External side effect:** An agent requests an email send or deployment. Kaji governs the request before application code calls the external provider.
3. **High-risk action:** A refund above a defined amount requires human approval. Kaji obtains a valid decision before the refund function runs.
4. **Repeated or retried action:** A caller retries a cancellation after losing its response. The same idempotency key resolves to one intended operation instead of issuing another cancellation.
5. **Ambiguous remote outcome:** A deployment request times out after the remote service may have accepted it. Kaji records `unknown` rather than treating the action as a safe ordinary failure to retry.

## What belongs in Kaji v0

Kaji v0 provides only these concerns:

- capability definition
- input validation
- principal identity
- authorization hook
- approval boundary
- execution
- idempotency
- cancellation
- timeout
- explicit execution outcome
- ambiguous or unknown outcome representation
- minimal execution evidence
- execution store abstraction
- in-memory store implementation

## Explicit non-goals

Kaji v0 does not provide:

- LLM or model providers. An agent framework or application owns model calls.
- Agent loops, planning, or reasoning. The caller owns decisions about what to request.
- Workflow orchestration, task runtime, retry orchestration, scheduling, or distributed workflow recovery. A workflow system owns sequencing and recovery policy.
- MCP server or runtime implementation, tool registries, integration catalogs, or framework-specific adapters. Callers adapt their framework to Kaji.
- Sessions, conversation state, event sourcing, a general event bus, or an artifact system. The host application owns those data models.
- A hosted control plane or observability framework. The application owns deployment and observability.
- An identity provider or authorization system. The application supplies identity and authorization decisions.
- Python or Go feature parity. TypeScript is the v0 implementation target. Python and Go are later scaffolds and do not expand this API.

## Product test

Replacing OpenAI Agents SDK with LangGraph, MCP, a cron job, or direct application code must not require changing the capability or its execution semantics.

If Kaji adds more conceptual machinery than the execution safety code it replaces, the design has failed.
