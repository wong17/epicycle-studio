import { ZodError } from './validation/zod';
export function explainError(error: unknown): string {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    return `Datos inválidos en ${issue?.path.join('.') || 'el proyecto'}. Revisa números, dimensión, formato y límites antes de volver a importar.`;
  }
  const message =
    error instanceof Error ? error.message : 'La operación falló. Tu proyecto sigue disponible.';
  if (message.startsWith('Unsupported character: ')) {
    return `El carácter «${message.slice('Unsupported character: '.length)}» no está disponible. Usa letras latinas, números o signos de puntuación.`;
  }
  const explanations: Record<string, string> = {
    'Text must contain at most 80 characters.': 'El texto debe tener como máximo 80 caracteres.',
    'Enter text to draw.': 'Escribe un nombre o mensaje para crear el recorrido.',
    'Drawing needs at least two points.': 'El recorrido necesita al menos dos puntos.',
    'Drawing exceeds 10000 points.': 'El recorrido supera el límite de 10 000 puntos.',
    'Drawing coordinates must be finite.': 'El recorrido contiene coordenadas no válidas.',
    'Drawing has no extent.': 'El recorrido no tiene tamaño. Prueba otra figura o archivo.',
    'Drawing extent is too small.': 'El recorrido es demasiado pequeño.',
    'Unknown route order.': 'Elige un orden de trazos válido.',
    'Each stroke needs at least two distinct points.':
      'Cada trazo necesita al menos dos puntos distintos.',
    'Variation must be a nonnegative integer.':
      'La variación debe ser un número entero positivo o cero.',

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
