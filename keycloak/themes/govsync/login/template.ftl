<#--
  Envoltorio de dos columnas del theme de GovSync ([HU-E01-01], D23;
  [E-01/HU-01], decisión del PO del 2026-11-16).

  Comparte con frontend/src/pages/Login.jsx los TOKENS y las CLASES de
  Tailwind (mismo tailwind.config.js), no el código: los componentes de React
  no corren en FreeMarker. Las clases de abajo son las mismas de Login.jsx y de
  EncabezadoPantalla.jsx; si cambian allá, cambian aquí y se regenera el CSS
  con `npm run build:tema-keycloak` (ver README). Una prueba de Vitest avisa si
  el CSS versionado no tiene alguna de estas clases.

  Preserva las directivas reales de Keycloak (firma del macro, manejo de
  mensajes, url.resourcesPath, <#nested>) — solo cambia el HTML de alrededor.
  No se probó contra un Keycloak corriendo (sin Docker disponible en el
  entorno donde se escribió) — primer punto a revisar si el login no
  renderiza como se espera.
-->
<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false displayWide=false showAnotherWayIfPresent=true>
<!DOCTYPE html>
<html lang="es" class="${properties.kcHtmlClass!}">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>${msg("loginTitle",(realm.displayName!'GovSync'))}</title>
    <#-- Mismas fuentes que frontend/index.html. -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
    <#if properties.styles?has_content>
        <#list properties.styles?split(' ') as style>
            <link href="${url.resourcesPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
</head>

<body>
    <div class="flex min-h-screen">
        <aside class="flex w-[42%] shrink-0 flex-col justify-between bg-navy p-8 xl:p-12">
            <div>
                <div class="text-2xl font-bold tracking-[0.12em] text-white">
                    GOV<span class="text-azul-claro">SYNC</span>
                </div>
                <p class="mt-1 text-minimo font-medium uppercase tracking-wide text-azul-tenue">
                    Sistema de Gestión &middot; Plan de Desarrollo
                </p>
            </div>

            <div class="border-l-2 border-azul pl-4">
                <p class="text-campo leading-relaxed text-blue-100">
                    <span class="font-medium text-white">
                        Plan de Desarrollo Municipal 2024&ndash;2027
                    </span>
                    &mdash; consolidación y cruce de la información de planeación, ejecución
                    presupuestal y proyectos de inversión.
                </p>
                <p class="mt-2 text-campo text-azul-claro">
                    Alcaldía Municipal de Santa Rosa, Cauca
                </p>
            </div>

            <div class="flex justify-between text-ayuda text-azul-apagado">
                <span>v2.0.0</span>
                <span class="font-mono">Vigencia 2026</span>
            </div>
        </aside>

        <div class="flex min-w-0 flex-1 items-center justify-center bg-white px-6">
            <div class="w-full max-w-sm">
                <header class="mb-6 flex flex-wrap items-start justify-between gap-4">
                    <div class="min-w-0">
                        <h1 class="text-pantalla font-semibold text-gray-800"><#nested "header"></h1>
                        <p class="mt-1 text-cuerpo text-gray-600">
                            Acceso restringido a funcionarios autorizados de la Alcaldía.
                        </p>
                    </div>
                </header>

                <#if displayMessage && message?has_content>
                    <div role="alert" class="mb-4 rounded-control px-3 py-2.5 text-ayuda font-medium <#if message.type = 'error'>bg-red-50 text-red-700<#elseif message.type = 'warning'>bg-amber-50 text-amber-900<#elseif message.type = 'success'>bg-green-50 text-green-800<#else>bg-tinte-azul text-sobretinte-azul</#if>">
                        <span>${kcSanitize(message.summary)?no_esc}</span>
                    </div>
                </#if>

                <#nested "form">

                <#if displayInfo>
                    <div class="mt-7 border-t border-borde-suave pt-5 text-ayuda text-gray-600">
                        <#nested "info">
                    </div>
                </#if>
            </div>
        </div>
    </div>
    <#-- [E-01/HU-01] CA03: aviso de límite de intentos por navegador (solo UX). -->
    <script type="module" src="${url.resourcesPath}/js/limite-intentos.js"></script>
</body>
</html>
</#macro>
