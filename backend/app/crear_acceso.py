"""
crear_acceso.py
Crea una cuenta con usuario y contraseña, o le cambia la contraseña si ya existe. Solo desde la consola del servidor:
la web no tiene ninguna ruta para poner contraseñas.

La contraseña se lee de la entrada estándar (primera línea), nunca de los argumentos: así no queda en el historial de la
consola ni en la lista de procesos. En Contabo:

    docker exec -i westvane-api python -m app.crear_acceso --usuario profesor --nombre "Profesor" --rol admin < clave.txt

Con --generar, crea una contraseña aleatoria y la escribe en la salida (para verla una sola vez).
"""
import argparse
import secrets
import string
import sys

from app.engine import auth_otp
from app.engine.common import OperationError
from app.init_db import init_database


def main() -> int:
    ap = argparse.ArgumentParser(description="Crea una cuenta con usuario y contraseña (o le cambia la contraseña).")
    ap.add_argument("--usuario", required=True)
    ap.add_argument("--nombre", default="")
    ap.add_argument("--rol", default="admin", choices=auth_otp.ROLES)
    ap.add_argument("--correo", default=None, help="Opcional: con él también se puede ingresar")
    ap.add_argument("--generar", action="store_true", help="Generar una contraseña aleatoria y mostrarla")
    args = ap.parse_args()

    if args.generar:
        abc = string.ascii_letters + string.digits
        password = "-".join("".join(secrets.choice(abc) for _ in range(5)) for _ in range(4))
    else:
        password = sys.stdin.readline().rstrip("\r\n")

    init_database(reset=False)  # aplica las migraciones que falten (columnas de intentos fallidos)
    try:
        res = auth_otp.set_password_account(args.usuario, password, args.nombre, args.rol, args.correo)
    except OperationError as exc:
        print(f"No se pudo: {exc}", file=sys.stderr)
        return 1
    print(f"Listo: cuenta «{res['username']}» con rol {res['role']}" + (f" y correo {res['email']}" if res["email"] else ""))
    if args.generar:
        print(f"Contraseña: {password}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
