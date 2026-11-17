<#--
  Formulario de usuario/clave del theme de GovSync ([HU-E01-01], D23;
  [E-01/HU-01], decisión del PO del 2026-11-16).

  Usa las MISMAS clases de Tailwind que la aplicación: el botón es el primario
  de frontend/src/components/shared/Boton.jsx y los campos son los de
  frontend/src/components/shared/Campo.jsx (etiqueta encima, borde de 1,5 px,
  anillo de foco, error con icono y role="alert"). Si cambian allá, cambian
  aquí y se regenera el CSS: `npm run build:tema-keycloak`.

  Sin "recordarme", "olvidé mi contraseña" ni registro: Login.jsx (el
  diseño que esto replica) tampoco los tiene — las cuentas las crea un
  administrador en Keycloak, no hay autorregistro.

  Se preservan los campos que el backend de Keycloak espera literalmente
  (name="username"/"password", el hidden credentialId, messagesPerField)
  — eso es lo que hace que el login funcione de verdad, no es parte del
  diseño visual.

  HU01-CA06 (Excel E-01): campo vacío debe mostrar "Campo obligatorio" y
  NO enviar la petición — por eso `required` en ambos campos, con
  `oninvalid`/`oninput` fijando el mensaje exacto (el texto nativo del
  navegador depende de su configuración regional, no siempre sale en
  español).

  HU01-CA03: `data-error-credenciales` le dice a
  resources/js/limite-intentos.js que la página volvió con error de
  credenciales; ese script cuenta los fallos POR NAVEGADOR (no por usuario,
  para no revelar qué cuentas existen) y bloquea el formulario al 3.º. Es solo
  experiencia de uso: el bloqueo real lo impone el servidor (ver SEGURIDAD.md).
-->
<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('username','password'); section>
    <#if section = "header">
        Iniciar sesión
    <#elseif section = "form">
        <#if realm.password>
            <#assign hayError = messagesPerField.existsError('username','password')>
            <#-- Región role="alert" siempre presente (vacía): un aviso que nace oculto
                 y aparece al quitar `hidden` no siempre se anuncia. -->
            <div id="limite-intentos" role="alert">
                <div id="limite-intentos-contenido" hidden>
                    <div id="limite-intentos-aviso" tabindex="-1" class="mb-4 flex items-start gap-1.5 rounded-control bg-red-50 px-3 py-2.5 text-ayuda font-medium text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-azul-accion focus-visible:ring-offset-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="mt-px shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                        <div>
                            <p>Límite de intentos alcanzado. Espere 5 minutos para volver a intentarlo.</p>
                            <p role="timer" id="limite-intentos-restante" class="mt-1 font-mono text-ayuda"></p>
                        </div>
                    </div>
                </div>
            </div>
            <form id="kc-form-login" action="${url.loginAction}" method="post" <#if hayError>data-error-credenciales="true"</#if>>
                <div class="mb-4">
                    <label for="username" class="mb-1.5 block text-campo font-medium text-gray-700">
                        <#if !realm.loginWithEmailAllowed>${msg("username")}<#elseif !realm.registrationEmailAsUsername>${msg("usernameOrEmail")}<#else>${msg("email")}</#if>
                    </label>
                    <input id="username" name="username" value="${(login.username!'')}" type="text" autofocus autocomplete="username"
                           class="min-h-11 w-full rounded-control border-[1.5px] bg-white px-3 text-campo text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-azul-accion focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:border-dashed disabled:bg-gray-100 disabled:text-gray-600 <#if hayError>border-red-700<#else>border-borde-control</#if>"
                           required oninvalid="this.setCustomValidity('Campo obligatorio')" oninput="this.setCustomValidity('')"
                           <#if hayError>aria-invalid="true" aria-describedby="username-error"</#if> />
                    <#if hayError>
                        <p id="username-error" role="alert" class="mt-1.5 flex items-start gap-1.5 text-ayuda font-medium text-red-700">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="mt-px shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                            <span>${kcSanitize(messagesPerField.getFirstError('username','password'))?no_esc}</span>
                        </p>
                    </#if>
                </div>

                <div class="mb-6">
                    <label for="password" class="mb-1.5 block text-campo font-medium text-gray-700">${msg("password")}</label>
                    <input id="password" name="password" type="password" autocomplete="current-password"
                           class="min-h-11 w-full rounded-control border-[1.5px] bg-white px-3 text-campo text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-azul-accion focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:border-dashed disabled:bg-gray-100 disabled:text-gray-600 <#if hayError>border-red-700<#else>border-borde-control</#if>"
                           required oninvalid="this.setCustomValidity('Campo obligatorio')" oninput="this.setCustomValidity('')"
                           <#if hayError>aria-invalid="true" aria-describedby="username-error"</#if> />
                </div>

                <input type="hidden" id="id-hidden-input" name="credentialId" <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if>/>
                <#-- Mismas clases que `Boton` primario (BASE + VARIANTES.primario) y `w-full`. -->
                <button name="login" id="kc-login" type="submit"
                        class="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-azul-accion px-4 text-campo font-semibold text-white transition-colors hover:bg-azul-accion-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-azul-accion focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-[1.5px] disabled:border-dashed disabled:border-gray-400 disabled:bg-gray-100 disabled:text-gray-600 disabled:hover:bg-gray-100">Ingresar</button>
            </form>
        </#if>
    </#if>
</@layout.registrationLayout>
