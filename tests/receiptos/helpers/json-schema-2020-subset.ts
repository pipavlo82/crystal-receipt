// Complete mechanical validator for the JSON Schema 2020-12 keywords used by
// the four frozen RSF schemas. Test-only; it is not a production evaluator.
export type Schema = Record<string, any>
export type Registry = Record<string, Schema>

function same(a: unknown, b: unknown): boolean { return JSON.stringify(a) === JSON.stringify(b) }
function typeMatches(value: unknown, type: string): boolean {
  if (type === "null") return value === null
  if (type === "array") return Array.isArray(value)
  if (type === "object") return typeof value === "object" && value !== null && !Array.isArray(value)
  if (type === "integer") return typeof value === "number" && Number.isInteger(value)
  return typeof value === type
}
function pointer(root: Schema, fragment: string): Schema {
  if (!fragment || fragment === "#") return root
  return fragment.replace(/^#\//, "").split("/").reduce((v:any,k)=>v[k.replace(/~1/g,"/").replace(/~0/g,"~")],root)
}
function resolveRef(ref: string, current: Schema, registry: Registry): [Schema,Schema] {
  if (ref.startsWith("#")) return [pointer(current,ref),current]
  const [id,fragment=""] = ref.split("#")
  const root=registry[id]
  if (!root) throw new Error(`unregistered schema ${id}`)
  return [pointer(root,fragment ? `#${fragment}` : "#"),root]
}

export function validateSchema(value: unknown, schema: Schema, registry: Registry, current=schema, path="$", errors:string[]=[]): string[] {
  if (schema.$ref) { const [target,root]=resolveRef(schema.$ref,current,registry); return validateSchema(value,target,registry,root,path,errors) }
  if (schema.const !== undefined && !same(value,schema.const)) errors.push(`${path}:const`)
  if (schema.enum && !schema.enum.some((x:unknown)=>same(value,x))) errors.push(`${path}:enum`)
  if (schema.type) {
    const types=Array.isArray(schema.type)?schema.type:[schema.type]
    if (!types.some((t:string)=>typeMatches(value,t))) { errors.push(`${path}:type`); return errors }
  }
  if (schema.pattern && typeof value === "string" && !new RegExp(schema.pattern).test(value)) errors.push(`${path}:pattern`)
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path}:minItems`)
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path}:maxItems`)
    if (schema.items) value.forEach((item,index)=>validateSchema(item,schema.items,registry,current,`${path}[${index}]`,errors))
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const record=value as Record<string,unknown>
    for (const key of schema.required??[]) if (!(key in record)) errors.push(`${path}.${key}:required`)
    if (schema.additionalProperties===false) for (const key of Object.keys(record)) if (!(key in (schema.properties??{}))) errors.push(`${path}.${key}:additional`)
    for (const [key,child] of Object.entries(schema.properties??{})) if (key in record) validateSchema(record[key],child as Schema,registry,current,`${path}.${key}`,errors)
  }
  for (const child of schema.allOf??[]) validateSchema(value,child,registry,current,path,errors)
  if (schema.oneOf) {
    const matches=schema.oneOf.filter((child:Schema)=>validateSchema(value,child,registry,current,path,[]).length===0).length
    if (matches!==1) errors.push(`${path}:oneOf(${matches})`)
  }
  if (schema.if && validateSchema(value,schema.if,registry,current,path,[]).length===0 && schema.then) validateSchema(value,schema.then,registry,current,path,errors)
  return errors
}
