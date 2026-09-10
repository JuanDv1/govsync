# Diseño del Producto / Arquitectura Base

## Arquitectura General

El sistema **GovSync** está diseñado bajo una arquitectura de **Monolito Modular** [30]. Esta arquitectura permite organizar internamente la aplicación en módulos independientes con responsabilidades claramente diferenciadas [32]. Se seleccionó esta opción en lugar de una arquitectura de microservicios para evitar la alta complejidad técnica de configurar y mantener múltiples bases de datos, redes virtuales, sistemas de comunicación entre servicios, contenedores, orquestadores y mecanismos de autenticación distribuida, lo cual consumiría una parte considerable de las 16 semanas de desarrollo en sobrecostos de infraestructura en vez de concentrarse en las funcionalidades del producto [30, 31].

A nivel organizativo, si en el futuro un módulo específico (como el encargado de la ingesta y procesamiento de archivos) requiere una capacidad de escalamiento horizontal superior, este puede separarse como un microservicio independiente (ETL Worker) sin necesidad de reescribir la lógica existente en la arquitectura [32, 89].

El backend está construido con **FastAPI** (Python), el frontend con **React** y el motor de base de datos es **PostgreSQL** [30].

## Estrategia de Despliegue en la Nube

Dado que los municipios de categoría 6 (aquellos con menor capacidad técnica, financiera y humana) no disponen de infraestructura tecnológica propia para alojar y mantener un servidor permanente, el sistema se aloja en infraestructura cloud, separando el frontend y el backend según lo que cada proveedor hace mejor [10, 32, 33]:

1. **Frontend (React):** Alojado en **Vercel** (plan gratuito), aprovechando su red de distribución global sin costo [33].
2. **Backend (FastAPI) y Base de Datos (PostgreSQL):** Vercel no es viable para esta sección ya que sus funciones serverless tienen un límite de ejecución de 5 minutos y no sostienen conexiones persistentes a una base de datos [33]. Se plantean dos fases:
   - **Fase de desarrollo y piloto académico:** Alojado en **Render** (plan gratuito) para un despliegue rápido y sin costo [34].
   - **Fase de producción:** Migración a una instancia de **AWS Lightsail** (desde $3.50 USD/mes), que corre el backend y la base de datos en una sola instancia con IP fija, sin pausas por inactividad y garantizando la persistencia del histórico de cortes (una condición no negociable para la herramienta) [34].

## Estructura de Ingesta y ETL

El núcleo del sistema de información municipal reside en la ingesta, sanitización y cruce relacional de hojas de cálculo de formato heterogéneo [39]. El sistema opta por una solución de ingesta de archivos planos (XLSX o CSV) y no por una integración directa vía APIs, dado que el Estado colombiano no expone APIs públicas en tiempo real para consultar SisPT, CUIPO o PIIP, siendo la exportación manual la única vía real que el municipio realiza de manera rutinaria [21].

### Archivos de Entrada del Sistema

El sistema automatiza el procesamiento y cruce de las siguientes cuatro fuentes de información [21, 22, 23]:

1. **Plan indicativo:** Archivo oficial exportado de **SisPT** con estructura estable y alta confiabilidad [22].
2. **Ejecución presupuestal:** Archivo exportado del software presupuestal municipal (**Prescon**), hoja "Formato Resumido Ejecucion Gast", de alta confiabilidad [22]. Contiene el registro de CDP (Certificado de Disponibilidad Presupuestal), RP (Registro Presupuestal) y pagos [22].
3. **Contratación:** Archivo exportado de Prescon, hoja "CONTRATACION", de confiabilidad media [22, 23].
4. **Relación de proyectos BPIN:** Archivo "Proyectos_2026" con celdas combinadas y formato variable entre municipios, de confiabilidad baja [23].

---

_Nota: Este documento sirve como especificación técnica base de la arquitectura para el agente de código._
