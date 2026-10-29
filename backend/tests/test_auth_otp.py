"""
Pruebas de autenticación sin contraseña (OTP por correo), empresas y roles.
"""
import pytest
from fastapi.testclient import TestClient

import app.database.db as db
import app.init_db as init_db


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("auth") / "auth.db")
    mp = pytest.MonkeyPatch()
    mp.setattr(db, "DB_PATH", path)
    mp.setattr(init_db, "DB_PATH", path)
    from app import main
    main.network.cache_clear()
    main._last_sync = 0.0
    with TestClient(main.app) as c:
        yield c
    main.network.cache_clear()
    mp.undo()


def test_request_otp_invalid_email(client):
    res = client.post("/api/auth/otp/request", json={"email": "no-es-correo"})
    assert res.status_code == 422


def test_request_otp_unregistered_email(client):
    res = client.post("/api/auth/otp/request", json={"email": "desconocido@correo.com"})
    assert res.status_code == 422
    assert "no está registrado" in res.json()["detail"]


def test_otp_flow_and_session(client):
    # 1. Solicitar código para usuario existente (semilla admin)
    email = "admin@westvane.com"
    res = client.post("/api/auth/otp/request", json={"email": email})
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert "dev_code" in data
    code = data["dev_code"]
    assert len(code) == 6 and code.isdigit()

    # 2. Verificar con código incorrecto
    wrong_res = client.post("/api/auth/otp/verify", json={"email": email, "code": "000000" if code != "000000" else "111111"})
    assert wrong_res.status_code == 422
    assert "incorrecto" in wrong_res.json()["detail"]

    # 3. Verificar con código correcto
    verify_res = client.post("/api/auth/otp/verify", json={"email": email, "code": code})
    assert verify_res.status_code == 200
    auth_data = verify_res.json()
    assert "token" in auth_data
    token = auth_data["token"]
    user = auth_data["user"]
    assert user["email"] == email
    assert user["role"] == "admin"
    assert user["company"] is not None
    assert "name" in user["company"]

    # 4. Código usado no puede reutilizarse
    reuse_res = client.post("/api/auth/otp/verify", json={"email": email, "code": code})
    assert reuse_res.status_code == 422

    # 5. Consultar identidad actual con token
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == email

    # 6. Sin token o token inválido
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer token_falso"}).status_code == 401

    # 7. Cerrar sesión
    logout_res = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert logout_res.status_code == 204
    # Ahora el token ya no debe ser válido
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_companies_and_user_management(client):
    # Listar empresas (debe existir la semilla)
    c_res = client.get("/api/companies")
    assert c_res.status_code == 200
    companies = c_res.json()["items"]
    assert len(companies) >= 1
    default_c = companies[0]

    # Crear una nueva empresa
    new_c_res = client.post("/api/companies", json={"name": "Transportes del Caribe S.A.", "nit": "800.123.456-1"}, params={"usuario": "admin"})
    assert new_c_res.status_code == 201
    new_company = new_c_res.json()
    assert new_company["name"] == "Transportes del Caribe S.A."

    # Intentar duplicar nombre de empresa
    dup_res = client.post("/api/companies", json={"name": "Transportes del Caribe S.A."})
    assert dup_res.status_code == 422

    # Crear un nuevo usuario
    new_user_res = client.post(
        "/api/admin/users",
        json={
            "email": "carolina.logistica@caribe.com",
            "full_name": "Carolina Herrera",
            "role": "operador",
            "company_id": new_company["company_id"],
        },
        params={"usuario": "admin"},
    )
    assert new_user_res.status_code == 201
    created_user = new_user_res.json()
    assert created_user["email"] == "carolina.logistica@caribe.com"
    assert created_user["role"] == "operador"
    assert created_user["company_id"] == new_company["company_id"]

    # Cambiar rol del usuario a lector
    role_res = client.put(f"/api/admin/users/{created_user['user_id']}/role", json={"role": "lector"}, params={"usuario": "admin"})
    assert role_res.status_code == 200
    assert role_res.json()["role"] == "lector"

    # El nuevo usuario puede solicitar OTP
    otp_res = client.post("/api/auth/otp/request", json={"email": "carolina.logistica@caribe.com"})
    assert otp_res.status_code == 200
    assert "dev_code" in otp_res.json()
