# Convenciones matemáticas

El dominio usa Y positivo hacia arriba; Canvas y SVG invierten Y sólo al adaptar pantalla. La fuente editable nunca se sustituye por muestras normalizadas.

Preparación: validar dimensión/coordenadas; deduplicar consecutivos; centrar en la caja y escalar uniformemente la dimensión mayor a longitud 2; aplicar cierre elegido; remuestrear por longitud de arco. El endpoint repetido no entra en la FFT. `sourceCenter` y `sourceScale` permiten restaurar el espacio del proyecto.

2D usa muestras complejas z=x+iy y FFT directa sin normalizar de fft.js. Se divide una sola vez por N. Para cada k: c[k] = sum(z[j] exp(-i 2πkj/N))/N. DC conserva el desplazamiento; las frecuencias son k si k<N/2 y k-N en otro caso. Nyquist es -N/2 y aparece una sola vez. El selector conserva K términos no constantes, por amplitud o frecuencia.

3D calcula una FFT real por coordenada. Cada armónico es a cos(2πnt)+b sin(2πnt). a=2Re(C), b=-2Im(C); Nyquist usa a=Re(C), b=0. H cuenta armónicos completos. Su orden usa energía discreta: (|a|²+|b|²)/2; Nyquist usa |a|².

La elipse espacial se descompone en dos círculos contrarrotatorios de una base ortonormal. El extremo es equivalente; la elección de base puede cambiar las fases individuales. Se manejan casos cero, colineales y casi degenerados. Los tests comparan 257 fases por caso.

El worker devuelve los coeficientes en espacio fuente. El renderer no restaura otra vez. RMS/máximo se calculan contra las N muestras en ese mismo marco y se multiplican por sourceScale para presentar unidades normalizadas. La DFT de referencia en tests es independiente de la implementación FFT.

El reloj usa fase [0,1), periodo 8 segundos y delta máximo de 100 ms. Pausa, scrub y visibilidad reinician la referencia temporal; la detección reactiva se actualiza como máximo 10 Hz. La animación matemática no usa easing decorativo.

La escultura usa un evaluador analítico y derivadas exactas. M2 acota la segunda derivada en fase; para L segmentos, error <= M2/(8L²). L está entre 512 y 2048. Las tolerancias son 0.005D, 0.01D o 0.02D y deben elegirse explícitamente. La sección tubular tiene 8 lados.

Decisión de exportación: GLB conserva coordenadas y unidades del proyecto, con transformaciones horneadas; `extras.units=project`. El plan proponía unidades normalizadas, pero escalar coordenadas trasladadas alteraba tamaño y posición. Mantener el mismo marco permite verificar la caja tras reimportar. El radio del tubo sí se expresa como radio normalizado y se convierte mediante D/2.
