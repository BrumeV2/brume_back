import type {
  OpenAPIObject,
  ParameterObject,
  ReferenceObject,
} from '@nestjs/swagger';

const methods = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
  'trace',
] as const;

/** The browser supplies Origin; Swagger supplies the CSRF header automatically. */
export function swaggerUiDocument(document: OpenAPIObject): OpenAPIObject {
  const uiDocument = structuredClone(document);
  const manualParameters = (
    parameters?: (ParameterObject | ReferenceObject)[],
  ) =>
    parameters?.filter(
      (parameter) =>
        '$ref' in parameter ||
        parameter.in !== 'header' ||
        !['origin', 'x-csrf-protection'].includes(parameter.name.toLowerCase()),
    );
  for (const path of Object.values(uiDocument.paths)) {
    if (path.parameters) path.parameters = manualParameters(path.parameters);
    for (const method of methods) {
      const operation = path[method];
      if (operation?.parameters)
        operation.parameters = manualParameters(operation.parameters);
    }
  }
  return uiDocument;
}

// Serialized by Nest into the browser: this function must not capture server variables.
export function swaggerRequestInterceptor(request: {
  headers: Record<string, string>;
}) {
  request.headers['X-CSRF-Protection'] = '1';
  return request;
}
