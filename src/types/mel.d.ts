declare module "*.mel" {
  import type { DomainSchema } from "@manifesto-ai/core";

  const schema: DomainSchema;

  export default schema;
}
