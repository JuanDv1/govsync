<#--
  Envoltorio de dos columnas del theme de GovSync ([HU-E01-01], D23):
  réplica de frontend/src/pages/Login.jsx (aside navy 42% + formulario).

  Preserva las directivas reales de Keycloak (firma del macro, manejo de
  mensajes, url.resourcesPath, <#nested>) — solo las clases/HTML del
  envoltorio son nuevas (govsync-*, no las clases del theme base, para no
  depender de que esos nombres sigan siendo los mismos en otra versión).
  No se probó contra un Keycloak corriendo (sin Docker disponible en el
  entorno donde se escribió) — primer punto a revisar si el login no
  renderiza como se espera.
-->
<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false displayWide=false showAnotherWayIfPresent=true>
<!DOCTYPE html>
<html class="${properties.kcHtmlClass!}"<#if realm.internationalizationEnabled> lang="${locale.currentLanguageTag}"</#if>>

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>${msg("loginTitle",(realm.displayName!'GovSync'))}</title>
    <#if properties.styles?has_content>
        <#list properties.styles?split(' ') as style>
            <link href="${url.resourcesPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
</head>

<body class="govsync-body">
    <div class="govsync-shell">
        <aside class="govsync-aside">
            <div>
                <div class="govsync-wordmark">GOV<span class="govsync-wordmark-accent">SYNC</span></div>
                <p class="govsync-tagline">Sistema de Gestión &middot; Plan de Desarrollo</p>
            </div>

            <div class="govsync-aside-info">
                <p class="govsync-aside-text">
                    <span class="govsync-aside-text-strong">Plan de Desarrollo Municipal 2024&ndash;2027</span>
                    &mdash; consolidación y cruce de la información de planeación, ejecución
                    presupuestal y proyectos de inversión.
                </p>
                <p class="govsync-aside-municipio">Alcaldía Municipal de Santa Rosa, Cauca</p>
            </div>

            <div class="govsync-aside-footer">
                <span>v2.0.0</span>
            </div>
        </aside>

        <div class="govsync-form-area">
            <div class="govsync-form-card">
                <h2 class="govsync-form-title"><#nested "header"></h2>
                <p class="govsync-form-subtitle">Acceso restringido a funcionarios autorizados de la Alcaldía.</p>

                <#if displayMessage && message?has_content>
                    <div class="govsync-alert govsync-alert-${message.type}">
                        <span>${kcSanitize(message.summary)?no_esc}</span>
                    </div>
                </#if>

                <#nested "form">

                <#if displayInfo>
                    <div class="govsync-form-info">
                        <#nested "info">
                    </div>
                </#if>
            </div>
        </div>
    </div>
</body>
</html>
</#macro>
