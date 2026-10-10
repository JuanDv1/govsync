<#--
  Formulario de usuario/clave del theme de GovSync ([HU-E01-01], D23).

  Sin "recordarme", "olvidé mi contraseña" ni registro: Login.jsx (el
  diseño que esto replica) tampoco los tiene — las cuentas las crea un
  administrador en Keycloak, no hay autorregistro.

  Se preservan los campos que el backend de Keycloak espera literalmente
  (name="username"/"password", el hidden credentialId, messagesPerField)
  — eso es lo que hace que el login funcione de verdad, no es parte del
  diseño visual.
-->
<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('username','password'); section>
    <#if section = "header">
        ${msg("doLogIn")}
    <#elseif section = "form">
        <#if realm.password>
            <form id="kc-form-login" onsubmit="login.disabled = true; return true;" action="${url.loginAction}" method="post">
                <div class="govsync-field">
                    <label for="username" class="govsync-label">
                        <#if !realm.loginWithEmailAllowed>${msg("username")}<#elseif !realm.registrationEmailAsUsername>${msg("usernameOrEmail")}<#else>${msg("email")}</#if>
                    </label>
                    <input tabindex="1" id="username" class="govsync-input" name="username" value="${(login.username!'')}" type="text" autofocus autocomplete="username"
                           aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>" />
                    <#if messagesPerField.existsError('username','password')>
                        <span id="input-error" class="govsync-input-error" aria-live="polite">
                            ${kcSanitize(messagesPerField.getFirstError('username','password'))?no_esc}
                        </span>
                    </#if>
                </div>

                <div class="govsync-field">
                    <label for="password" class="govsync-label">${msg("password")}</label>
                    <input tabindex="2" id="password" class="govsync-input" name="password" type="password" autocomplete="current-password"
                           aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>" />
                </div>

                <input type="hidden" id="id-hidden-input" name="credentialId" <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if>/>
                <input tabindex="3" class="govsync-submit" name="login" id="kc-login" type="submit" value="${msg("doLogIn")}"/>
            </form>
        </#if>
    </#if>
</@layout.registrationLayout>
