# Product Backlog y Sprint Backlog del Sprint 1

El backlog de desarrollo de **GovSync** se estructura bajo el marco ágil Scrum para guiar el MVP en ciclos definidos de desarrollo [52].

## Historias Épicas (Product Backlog General)

Las historias épicas definen los grandes bloques de valor funcional del producto [45]:

- **EPIC-001: Gestión de Acceso y Roles:** Control de inicio de sesión y asignación de roles (ADMIN, SUPERVISOR, ALCALDE) sin autorregistro público [45].
- **EPIC-002: Gestión de Integración de Archivos Fuente por Cortes:** Creación de cortes de seguimiento, carga y validación de las cuatro fuentes de datos (SisPT, Prescon/CUIPO, PIIP) y visualización de la matriz de relación consolidada [46].
- **EPIC-003: Seguimiento Físico:** Consulta de metas sectoriales por parte de los supervisores y registro de avance físico junto con observaciones (con datos financieros en modo solo lectura) [47].
- **EPIC-004: Análisis, Control y Seguimiento del Plan de Acción:** Consulta del Plan de Acción consolidado con filtros multidimensionales, detección de inconsistencias y exportación a Excel [48].

## Sprint Backlog — Sprint 1

El Sprint 1 se enfoca en establecer la infraestructura de ingesta de archivos, versionamiento de cortes y la visualización de la matriz de relación inicial para validar que la consolidación sea exitosa [52].

| Código HU | Título de la Historia de Usuario                                                                                                                                                                    | Responsable Asignado    | Estimación (Story Points) |
| :-------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------- | :------------------------ |
| **HU-01** | Crear un corte indicando la vigencia y la fecha exacta, con el fin de agrupar bajo una misma referencia las fuentes y resultados correspondientes a un momento de seguimiento [99].                 | Juan Esteban Muñoz [99] | 8 pts [99]                |
| **HU-02** | Cargar el archivo fuente correspondiente al Plan Indicativo, para incorporar las metas, programación, estructura e información del plan que será utilizada durante el seguimiento [99].             | Karold Delgado [100]    | 3 pts [100]               |
| **HU-03** | Cargar el archivo presupuestal del corte, incluyendo sus pestañas de ejecución y contratación, para incorporar la información financiera y contractual necesaria para realizar los cruces [100].    | Juan Perdomo [100]      | 8 pts [100]               |
| **HU-04** | Cargar la plantilla de proyectos BPIN diligenciada por el municipio, para incorporar la relación entre proyecto, BPIN, indicador y rubro utilizada durante el cruce de información [100].           | Cristhian Unas [100]    | 13 pts [100]              |
| **HU-07** | Visualizar la matriz de relación del corte actual, mostrando de forma consolidada cómo se conectan las fuentes cargadas, para consultar la trazabilidad sin reconstruir manualmente el cruce [101]. | Karold Delgado [101]    | 5 pts [101]               |

**Puntaje Total Estimado del Sprint 1:** **37 Story Points** [99, 100, 101].
