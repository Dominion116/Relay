import type { X402Resource } from '../types/x402';

export const MAX_REQUEST_BYTES = 16 * 1024;

interface PropertySchema {
  type: 'string' | 'number' | 'integer' | 'array';
  description?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  items?: PropertySchema;
  default?: unknown;
}

const limits: Record<string, Partial<PropertySchema>> = {
  query: { minLength: 1, maxLength: 1024 },
  topic: { minLength: 1, maxLength: 1024 },
  claim: { minLength: 1, maxLength: 2048 },
  doi: { minLength: 7, maxLength: 2048, pattern: '^(?:https?://(?:dx\\.)?doi\\.org/)?10\\.\\d{4,9}/\\S+$' },
  assets: { minItems: 1, maxItems: 10, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 64, pattern: '^[a-z0-9][a-z0-9-]*$' } },
  targets: { minItems: 1, maxItems: 10, uniqueItems: true, items: { type: 'string', pattern: '^[A-Z]{3}$' } },
  vsCurrency: { pattern: '^[a-z]{3,5}$' },
  baseCurrency: { pattern: '^[A-Z]{3}$' },
  countryCode: { pattern: '^[A-Z]{2}$' },
  limit: { type: 'integer', minimum: 1, maximum: 20 },
  year: { type: 'integer', minimum: 1900, maximum: 2100 },
  latitude: { minimum: -90, maximum: 90 },
  longitude: { minimum: -180, maximum: 180 }
};

export function getRequestSchema(resource: X402Resource) {
  const properties: Record<string, PropertySchema> = {};
  for (const [name, field] of Object.entries(resource.schema.request)) {
    properties[name] = {
      type: field.type.includes('array') ? 'array' : field.type as PropertySchema['type'],
      description: field.description,
      ...limits[name]
    };
    if (!field.required && Object.prototype.hasOwnProperty.call(resource.defaultParams, name)) {
      properties[name].default = name === 'year' ? new Date().getUTCFullYear() : resource.defaultParams[name];
    }
  }
  return {
    type: 'object' as const,
    properties,
    required: Object.entries(resource.schema.request).filter(([, field]) => field.required).map(([name]) => name),
    additionalProperties: false as const
  };
}

function validateValue(name: string, value: unknown, rule: PropertySchema): void {
  if (rule.type === 'string') {
    if (typeof value !== 'string' || !value.trim() ||
        (rule.minLength !== undefined && value.length < rule.minLength) ||
        (rule.maxLength !== undefined && value.length > rule.maxLength) ||
        (rule.pattern && !new RegExp(rule.pattern).test(value))) {
      throw new Error(`Invalid ${name}: expected a non-empty string matching the endpoint schema.`);
    }
  } else if (rule.type === 'array') {
    if (!Array.isArray(value) || value.length < (rule.minItems ?? 1) || value.length > (rule.maxItems ?? 10)) {
      throw new Error(`Invalid ${name}: expected an array of 1 to 10 strings.`);
    }
    if (rule.uniqueItems && new Set(value).size !== value.length) throw new Error(`Invalid ${name}: duplicate items are not allowed.`);
    for (const item of value) validateValue(name, item, rule.items ?? { type: 'string' });
  } else if (typeof value !== 'number' || !Number.isFinite(value) ||
      (rule.type === 'integer' && !Number.isInteger(value)) ||
      (rule.minimum !== undefined && value < rule.minimum) ||
      (rule.maximum !== undefined && value > rule.maximum)) {
    throw new Error(`Invalid ${name}: expected ${rule.type} between ${rule.minimum} and ${rule.maximum}.`);
  }
}

export function validateResourceParams(resource: X402Resource, input: unknown): Record<string, any> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Request body must be a JSON object.');
  const schema = getRequestSchema(resource);
  const source = input as Record<string, unknown>;
  const result: Record<string, any> = {};
  for (const name of Object.keys(source)) {
    if (!Object.prototype.hasOwnProperty.call(schema.properties, name)) throw new Error(`Unknown request field: ${name}.`);
  }
  for (const [name, rule] of Object.entries(schema.properties)) {
    const supplied = Object.prototype.hasOwnProperty.call(source, name);
    if (!supplied && schema.required.includes(name)) throw new Error(`Missing required request field: ${name}.`);
    let value = supplied ? source[name] : rule.default;
    if (value === undefined && !supplied) continue;
    if (typeof value === 'string') {
      value = value.trim();
      if (name === 'baseCurrency' || name === 'countryCode') value = (value as string).toUpperCase();
      if (name === 'vsCurrency') value = (value as string).toLowerCase();
      if (name === 'doi') value = (value as string).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');
    }
    if (Array.isArray(value)) {
      value = value.map(item => typeof item !== 'string' ? item : name === 'targets' ? item.trim().toUpperCase() : item.trim().toLowerCase());
    }
    validateValue(name, value, rule);
    result[name] = value;
  }
  return result;
}
