/**
 * Vista previa de códigos descartados al cargar la plantilla BPIN.
 *
 * TARJETA: [HU-04][FE-03] Vista previa de códigos extraídos y descartados
 * CUBRE: CA-4, CA-5
 *
 * «Los descartes son la información más valiosa de esta pantalla»
 * (comentario del propio lector, `proyectos.py`) — por eso prioriza en vez
 * de mostrar una lista plana: D14 (docs/DECISIONES.md) clasifica cada
 * descarte por `categoria`, distinguiendo un intento real de código que
 * falló (`POSIBLE_CERO_PERDIDO`/`LONGITUD_LARGA`) de ruido de texto libre —
 * una fecha, un año, un porcentaje — que nunca pretendió ser un código
 * (`LONGITUD_CORTA`).
 *
 * PROPS, NO CONSUMO DE API: recibe `descartes` ya resuelto (la respuesta de
 * `POST /cortes/{id}/archivos/PROYECTOS`, campo `descartes` — ver
 * `ArchivoFuenteRespuestaParcial`/`DescarteRespuesta` en
 * `cortes/api/router.py`). Este componente no llama a `api.cargarArchivo`;
 * quien construya el flujo de carga (Paso 2 de `NuevoCorte.jsx`,
 * [HU-04][FE-02]) es quien decide cuándo pasarle el resultado, igual que ya
 * hace `CargaDeArchivo.jsx` con su prop `resultado`.
 *
 * Se integra pasando el `<VistaPreviaDescartes descartes={...} />` que
 * devuelve como la prop `resultado` de `CargaDeArchivo` cuando
 * `tipo === "PROYECTOS"` — sin que este componente conozca nada de
 * `CargaDeArchivo` ni de `NuevoCorte.jsx`.
 */

// PROPUESTA DE TEXTO, NO DECIDIDA — verificado contra docs/archivo/sprint-1/PLANDETRABAJO.md,
// ESPECIFICACIONES_TECNICAS.md y DECISIONES.md: ninguno define copy de
// interfaz para estas tres categorías (D14 solo las nombra a nivel técnico:
// POSIBLE_CERO_PERDIDO/LONGITUD_CORTA/LONGITUD_LARGA). Estos tres títulos
// los redacté yo mismo para que el componente fuera demostrable — quien
// revise esta pantalla con la administradora (o Emilse, si hay oportunidad)
// debería poder cambiarlos sin que se sienta como tocar código terminado.
const ETIQUETAS_CATEGORIA = {
  posible_cero_perdido: {
    titulo: "Posible código con el cero perdido",
    prioridad: "alta",
  },
  longitud_larga: {
    titulo: "Posible código mal formado",
    prioridad: "alta",
  },
  longitud_corta: {
    titulo: "Probablemente no es un código",
    prioridad: "baja",
  },
};

//: Aspecto de cada grupo según su prioridad. La alta (posible código real
//: perdido) usa el tono de alerta de siempre —ámbar oscuro `#92400e`
//: (`amber-800`, 6,8:1 sobre `amber-50`)—; la baja, un borde neutro para no
//: competir con lo que sí merece revisión.
const ESTILO_GRUPO = {
  alta: "border-amber-800 bg-amber-50",
  baja: "border-gray-200 bg-white",
};

function agruparPorCategoria(descartes) {
  const grupos = new Map();
  for (const descarte of descartes) {
    const clave = descarte.categoria;
    if (!grupos.has(clave)) {
      grupos.set(clave, []);
    }
    grupos.get(clave).push(descarte);
  }
  // Prioridad alta primero: es la información más valiosa de la pantalla.
  return [...grupos.entries()].sort(([a], [b]) => {
    const prioridadA = ETIQUETAS_CATEGORIA[a]?.prioridad === "alta" ? 0 : 1;
    const prioridadB = ETIQUETAS_CATEGORIA[b]?.prioridad === "alta" ? 0 : 1;
    return prioridadA - prioridadB;
  });
}

export default function VistaPreviaDescartes({ descartes }) {
  if (!descartes || descartes.length === 0) {
    return null;
  }

  const grupos = agruparPorCategoria(descartes);

  return (
    <div className="flex flex-col gap-3">
      {/* Propuesta de texto, no decidida — mismo caso que ETIQUETAS_CATEGORIA arriba. */}
      <p className="font-semibold text-amber-800">
        {descartes.length === 1
          ? "1 fragmento descartado — revísalo antes de continuar."
          : `${descartes.length} fragmentos descartados — revísalos antes de continuar.`}
      </p>

      {grupos.map(([categoria, items]) => {
        const etiqueta = ETIQUETAS_CATEGORIA[categoria] ?? {
          titulo: categoria,
          prioridad: "baja",
        };
        return (
          <section
            key={categoria}
            className={`rounded-control border px-4 py-3 ${
              ESTILO_GRUPO[etiqueta.prioridad] ?? ESTILO_GRUPO.baja
            }`}
            data-prioridad={etiqueta.prioridad}
          >
            <h3 className="mb-2 text-campo font-semibold text-gray-800">
              {etiqueta.titulo}
            </h3>
            <ul className="flex flex-col gap-1.5">
              {items.map((descarte, indice) => (
                <li
                  key={`${descarte.valor_crudo}-${indice}`}
                  className="flex items-baseline gap-3 text-campo"
                >
                  <span className="whitespace-nowrap font-mono">
                    {descarte.valor_crudo}
                  </span>
                  <span className="text-gray-600">{descarte.motivo}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
