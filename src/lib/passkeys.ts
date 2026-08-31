import {
  authenticatePasskeyCredential,
  getPasskeyAuthenticationOptions,
  getPasskeyRegistrationOptions,
  registerPasskeyCredential,
} from "./backendApi";

type JsonObject = Record<string, unknown>;

export function passkeysAvailable() {
  return typeof window !== "undefined"
    && window.isSecureContext
    && "PublicKeyCredential" in window
    && typeof navigator.credentials?.create === "function"
    && typeof navigator.credentials?.get === "function";
}

export async function createPasskey(label: string) {
  ensureAvailable();
  const options = await getPasskeyRegistrationOptions();
  const publicKey = decodeCreationOptions(options);
  let credential: Credential | null;
  try {
    credential = await navigator.credentials.create({ publicKey });
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      throw new Error("패스키 등록이 취소되었습니다. 화면 잠금을 해제하고 다시 시도해 주세요.");
    }
    throw error;
  }
  if (!(credential instanceof PublicKeyCredential)) throw new Error("패스키 등록이 취소되었습니다.");
  const response = credential.response;
  if (!(response instanceof AuthenticatorAttestationResponse)) throw new Error("지원되지 않는 패스키 응답입니다.");
  return registerPasskeyCredential({
    publicKey: {
      credential: {
        id: credential.id,
        rawId: encodeBase64Url(credential.rawId),
        type: credential.type,
        response: {
          attestationObject: encodeBase64Url(response.attestationObject),
          clientDataJSON: encodeBase64Url(response.clientDataJSON),
          transports: typeof response.getTransports === "function" ? response.getTransports() : [],
        },
        clientExtensionResults: credential.getClientExtensionResults(),
        authenticatorAttachment: credential.authenticatorAttachment,
      },
      label: label.trim() || deviceLabel(),
    },
  });
}

export async function signInWithPasskey() {
  ensureAvailable();
  const options = await getPasskeyAuthenticationOptions();
  const publicKey = decodeRequestOptions(options);
  let credential: Credential | null;
  try {
    credential = await navigator.credentials.get({ publicKey });
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      throw new Error("등록된 패스키가 없거나 인증이 취소되었습니다. 처음이라면 비밀번호로 로그인한 뒤 설정에서 패스키를 등록해 주세요.");
    }
    throw error;
  }
  if (!(credential instanceof PublicKeyCredential)) throw new Error("패스키 로그인이 취소되었습니다.");
  const response = credential.response;
  if (!(response instanceof AuthenticatorAssertionResponse)) throw new Error("지원되지 않는 패스키 응답입니다.");
  return authenticatePasskeyCredential({
    id: credential.id,
    rawId: encodeBase64Url(credential.rawId),
    type: credential.type,
    response: {
      authenticatorData: encodeBase64Url(response.authenticatorData),
      clientDataJSON: encodeBase64Url(response.clientDataJSON),
      signature: encodeBase64Url(response.signature),
      userHandle: response.userHandle ? encodeBase64Url(response.userHandle) : null,
    },
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: credential.authenticatorAttachment,
  });
}

function decodeCreationOptions(input: JsonObject): PublicKeyCredentialCreationOptions {
  const options = input as unknown as PublicKeyCredentialCreationOptionsJSON;
  if (typeof PublicKeyCredential.parseCreationOptionsFromJSON === "function") {
    return PublicKeyCredential.parseCreationOptionsFromJSON(options);
  }
  return {
    ...(input as unknown as PublicKeyCredentialCreationOptions),
    challenge: decodeBase64Url(String(input.challenge ?? "")),
    user: {
      ...((input.user ?? {}) as PublicKeyCredentialUserEntity),
      id: decodeBase64Url(String((input.user as JsonObject | undefined)?.id ?? "")),
    },
    excludeCredentials: ((input.excludeCredentials ?? []) as JsonObject[]).map((item) => ({
      ...(item as unknown as PublicKeyCredentialDescriptor),
      id: decodeBase64Url(String(item.id ?? "")),
    })),
  };
}

function decodeRequestOptions(input: JsonObject): PublicKeyCredentialRequestOptions {
  const options = input as unknown as PublicKeyCredentialRequestOptionsJSON;
  if (typeof PublicKeyCredential.parseRequestOptionsFromJSON === "function") {
    return PublicKeyCredential.parseRequestOptionsFromJSON(options);
  }
  return {
    ...(input as unknown as PublicKeyCredentialRequestOptions),
    challenge: decodeBase64Url(String(input.challenge ?? "")),
    allowCredentials: ((input.allowCredentials ?? []) as JsonObject[]).map((item) => ({
      ...(item as unknown as PublicKeyCredentialDescriptor),
      id: decodeBase64Url(String(item.id ?? "")),
    })),
  };
}

function encodeBase64Url(value: ArrayBuffer) {
  const bytes = new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return bytes.buffer;
}

function ensureAvailable() {
  if (!passkeysAvailable()) throw new Error("이 브라우저 또는 연결에서는 패스키를 사용할 수 없습니다. HTTPS에서 다시 시도해 주세요.");
}

function deviceLabel() {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform || navigator.platform || "기기";
  return `${platform} 패스키`;
}
