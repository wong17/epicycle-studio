import { ZodError } from 'zod';
export function explainError(error: unknown): string {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    return `Datos inválidos en ${issue?.path.join('.') || 'el proyecto'}. Revisa números, dimensión, formato y límites antes de volver a importar.`;
  }
  const message =
    error instanceof Error ? error.message : 'La operación falló. Tu proyecto sigue disponible.';
  const explanations: Record<string, string> = {
    EMPTY: 'Dibuja una trayectoria antes de calcular.',
    DEGENERATE: 'El trazo es demasiado pequeño o repetido. Usa al menos tres puntos distintos.',
    DIMENSION: 'Las coordenadas no corresponden a la dimensión del proyecto.',
    NON_FINITE: 'Todas las coordenadas deben ser números finitos.',
    BOUNDS: 'Las coordenadas deben estar entre −1 000 000 y 1 000 000.',
    LIMIT: 'El trazo supera el límite de 10 000 puntos.',
    COUNT: 'La cantidad de muestras o componentes está fuera del rango permitido.',
  };
  return explanations[message] ?? message;
}
