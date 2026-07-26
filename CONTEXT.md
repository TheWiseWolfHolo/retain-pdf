# RetainPDF Provider Extensions

This context defines the language used for translation model access in the RetainPDF fork. It separates reusable service configuration from the model selected by an individual translation job.

## Language

**Provider Profile**:
An instance-wide reusable translation service configuration containing an adapter, Base URL, credential reference, default model, and optional custom request format.
_Avoid_: Provider account, API configuration, model configuration

**Provider Adapter**:
An explicit translator between RetainPDF's canonical LLM request and one provider protocol. Built-in adapters include OpenAI Chat Completions, Anthropic Messages, and Gemini Generate Content.
_Avoid_: Driver, plugin, backend

**Custom Request Format**:
A declarative HTTP JSON/SSE mapping owned by one Provider Profile. It defines the request path, headers, JSON body template, and response extraction paths without executing user code.
_Avoid_: Script, plugin, arbitrary request

**Provider Snapshot**:
The non-secret, immutable copy of the Provider Profile configuration used by one Translation Job. It preserves reproducibility when the original profile later changes.
_Avoid_: Provider copy, frozen profile

**Credential Reference**:
An opaque pointer to a secret held by the instance secret store. It is safe to persist in Provider Profiles, Provider Snapshots, and stage specifications because it is not the credential itself.
_Avoid_: API key, token value

**Model Selection**:
The concrete model ID chosen for one Translation Job. A Provider Profile supplies a default model and may expose a model catalog, but does not own separate model records.
_Avoid_: Provider model

**Translation Job**:
A single RetainPDF execution that references one Provider Profile and records the resulting Provider Snapshot and Model Selection.
_Avoid_: Request, run

**Built-in Provider Profile**:
A Provider Profile backed by a code-owned Provider Adapter with predefined request and response mappings.
_Avoid_: Official provider

**Custom Provider Profile**:
A Provider Profile backed by the declarative Custom Request Format adapter.
_Avoid_: Custom plugin, custom adapter
