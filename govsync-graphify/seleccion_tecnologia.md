# Selección de Tecnología y Plataformas de Gestión

La justificación y análisis comparativo para la adopción de la plataforma de desarrollo de **GovSync** y sus herramientas de gestión se detallan a continuación.

## 1. Justificación de la Plataforma Tecnológica

El núcleo del sistema de información municipal reside en la ingesta, sanitización y cruce relacional de hojas de cálculo de formato heterogéneo [39]. Por lo tanto, se evaluaron diversas tecnologías bajo criterios de rendimiento, comunidad, curva de aprendizaje y licenciamiento [37]:

### Backend: FastAPI sobre Python

- **Seleccionado por:** Su alto rendimiento, acceso directo a librerías maduras como **pandas** y **openpyxl** (óptimas para la manipulación compleja de archivos XLSX), y su capacidad para generar documentación OpenAPI de forma automatizada [37, 39, 98].
- **Ecosistemas Descartados:**
  - _NestJS (Node.js):_ Descartado debido a que el procesamiento de archivos Excel en JavaScript requiere librerías menos maduras, incrementando el esfuerzo de implementación para la lógica más crítica del sistema [39].
  - _Spring Boot (Java):_ Cuenta con Apache POI para XLSX, pero carece de un equivalente con la adopción y versatilidad de pandas en Python [39, 40]. Esto obligaría a implementar recorridos explícitos sobre colecciones para operaciones que en pandas se expresan como simples operaciones sobre columnas completas, incrementando la verbosidad [40].

### Frontend: React + Vite

- **Seleccionado por:** Sus ventajas de ecosistema, facilidad de adopción, amplia comunidad y rapidez de desarrollo con interfaces de tablas de datos complejas [40]. Además, facilita la rotación de roles dado que integrantes sin experiencia previa en frontend pueden asumir tareas gracias a la abundancia de ejemplos y documentación de referencia [40].
- **Ecosistemas Descartados:** _Vue 3 + Vite_, que aunque técnicamente cumplía con los requerimientos de reactividad, se priorizó React por la familiaridad de la comunidad y la abundancia de recursos listos para visualizaciones tabulares complejas [38, 40].

### Base de Datos: PostgreSQL

- **Seleccionado por:** Ser el estándar relacional de código abierto que cumple de forma adecuada con las propiedades ACID necesarias para transacciones financieras públicas [38]. Ofrece soporte para almacenar mapeos variables de los municipios en columnas de tipo **JSONB**, permitiendo asimilar variaciones en los archivos exportados sin romper la normalización relacional [38, 41].
- **Ecosistemas Descartados:** _MongoDB_, que aunque ofrece flexibilidad documental, carece de las garantías transaccionales relacionales robustas requeridas para rubros y apropiaciones presupuestales [38].

---

## 2. Selección de la Plataforma de Gestión del Proyecto

Se evaluaron tres plataformas para la gestión del backlog y seguimiento del desarrollo ágil durante las 16 semanas del proyecto [101, 103]:

| Plataforma       | Fortalezas Clave                                                                                                                                     | Limitaciones / Descarte                                                                                                                      |
| :--------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| **Jira**         | Tableros Scrum y Kanban robustos; generación nativa de métricas ágiles avanzados de velocidad; gestión avanzada de historias épicas [101].           | Elevada curva de aprendizaje y configuración inicial que consume tiempo significativo de desarrollo técnico [102].                           |
| **Azure DevOps** | Integración nativa con pipelines de CI/CD, repositorios Git y backlogs jerárquicos integrados [102].                                                 | Interfaz visual compleja para revisiones rápidas; menor flexibilidad intuitiva para personalizar las tarjetas de tareas de forma ágil [102]. |
| **Trello**       | **Seleccionada.** Gran simplicidad, interfaz altamente intuitiva, curva de aprendizaje nula y rápida adopción e implementación para el equipo [102]. | Ausencia nativa de métricas de rendimiento ágil, requiriendo Power-Ups o integraciones externas para gráficos avanzados [103].               |

### Justificación de Trello

Dado que el proyecto cuenta con un tiempo limitado de desarrollo (16 semanas) y un esquema estricto de rotación de roles por sprint, la adopción de una herramienta con **baja fricción operativa** como **Trello** permite que el equipo concentre el 100% de su esfuerzo técnico en la implementación del software, en lugar de perder tiempo valioso configurando y administrando un flujo de trabajo complejo en Jira o Azure DevOps [103]. Trello permite de forma intuitiva estructurar las fases del Sprint: _Product Backlog, Sprint Backlog, In Progress, Code Review/QA y Done_, facilitando el seguimiento en las reuniones diarias [104].
