"""
fleet_wh.py
Endpoints de la flota de vehículos y de la red de bodegas.

  Flota
    GET  /api/fleet/catalog | /api/fleet/summary
    GET/POST /api/fleet/vehicles          GET/PUT/DELETE /api/fleet/vehicles/{id}
    POST /api/fleet/vehicles/{id}/retire | reactivate | faults | maintenance
    GET  /api/fleet/faults | /api/fleet/maintenance
    PUT  /api/fleet/faults/{id}
    GET  /api/fleet/maintenance/{id}/pdf          Orden de trabajo para imprimir y diligenciar en el taller
    POST /api/fleet/maintenance/{id}/start | complete | cancel
    GET/POST /api/fleet/drivers           PUT/DELETE /api/fleet/drivers/{id}
    GET  /api/shipments/{code}/legs/{i}/vehicles   Vehículos que pueden cubrir el tramo i
    PUT  /api/shipments/{code}/legs/{i}/vehicle    Fija a mano el vehículo del tramo (vacío = automático)

  Bodegas
    GET  /api/warehouses/roles | /api/warehouses/summary | /api/warehouses/transfers
    GET/POST /api/warehouses              GET/PUT/DELETE /api/warehouses/{id}
    POST /api/warehouses/{id}/stock       PUT/DELETE /api/warehouses/{id}/stock/{sku}
    POST /api/warehouses/{id}/movements
    POST /api/warehouses/transfers

Los cuerpos son JSON libres que cada función del motor valida y rechaza con un mensaje
en español (422). `usuario` firma el cambio en el historial (nombre declarado, sin autenticación).
"""
from __future__ import annotations

from datetime import datetime
from typing import Callable

from fastapi import Body, FastAPI, HTTPException, Response

from app.engine import fleet, warehouses
from app.engine.common import OperationError


def register(app: FastAPI, sync: Callable[[], datetime], network: Callable) -> None:
    def run(fn, *args, **kw):
        try:
            return fn(*args, **kw)
        except OperationError as exc:
            raise HTTPException(status_code=422, detail=str(exc))

    def read(fn, *args):
        """Lectura de un detalle: lo que no existe responde 404 (las acciones responden 422)."""
        try:
            return fn(*args)
        except OperationError as exc:
            raise HTTPException(status_code=404 if "no existe" in str(exc) else 422, detail=str(exc))

    def who(body: dict) -> str | None:
        return body.get("usuario")

    # ------------------------------------------------------------------ Flota
    @app.get("/api/fleet/catalog")
    def fleet_catalog() -> dict:
        return fleet.catalog()

    @app.get("/api/fleet/summary")
    def fleet_summary() -> dict:
        return fleet.summary(sync())

    @app.get("/api/fleet/vehicles")
    def fleet_vehicles(mode: str | None = None, status: str | None = None, q: str | None = None,
                       warehouse_id: int | None = None) -> dict:
        items = fleet.list_vehicles(sync(), mode=mode, status=status, q=q, warehouse_id=warehouse_id)
        return {"count": len(items), "items": items}

    @app.post("/api/fleet/vehicles", status_code=201)
    def fleet_vehicle_create(body: dict = Body(...)) -> dict:
        return run(fleet.create_vehicle, body, who(body), sync())

    @app.get("/api/shipments/{code}/legs/{leg_index}/vehicles")
    def leg_vehicles(code: str, leg_index: int) -> dict:
        return read(fleet.leg_vehicle_options, code, leg_index, sync())

    @app.put("/api/shipments/{code}/legs/{leg_index}/vehicle")
    def leg_vehicle_set(code: str, leg_index: int, body: dict = Body(...)) -> dict:
        return read(fleet.set_leg_vehicle, code, leg_index, body.get("vehicle_ids"), who(body), sync())

    @app.get("/api/fleet/vehicles/{vehicle_id}")
    def fleet_vehicle(vehicle_id: int) -> dict:
        return read(fleet.vehicle_detail, vehicle_id, sync())

    @app.put("/api/fleet/vehicles/{vehicle_id}")
    def fleet_vehicle_update(vehicle_id: int, body: dict = Body(...)) -> dict:
        return run(fleet.update_vehicle, vehicle_id, body, who(body), sync())

    @app.delete("/api/fleet/vehicles/{vehicle_id}")
    def fleet_vehicle_delete(vehicle_id: int, usuario: str | None = None) -> dict:
        return run(fleet.delete_vehicle, vehicle_id, usuario)

    @app.post("/api/fleet/vehicles/{vehicle_id}/retire")
    def fleet_vehicle_retire(vehicle_id: int, body: dict = Body(...)) -> dict:
        return run(fleet.retire_vehicle, vehicle_id, body.get("reason"), who(body), sync())

    @app.post("/api/fleet/vehicles/{vehicle_id}/reactivate")
    def fleet_vehicle_reactivate(vehicle_id: int, body: dict = Body(default={})) -> dict:
        return run(fleet.reactivate_vehicle, vehicle_id, who(body), sync())

    @app.post("/api/fleet/vehicles/{vehicle_id}/faults", status_code=201)
    def fleet_fault_report(vehicle_id: int, body: dict = Body(...)) -> dict:
        return run(fleet.report_fault, vehicle_id, body, who(body), sync())

    @app.get("/api/fleet/faults")
    def fleet_faults(status: str | None = None, limit: int = 200) -> dict:
        items = fleet.list_faults(status, limit)
        return {"count": len(items), "items": items}

    @app.put("/api/fleet/faults/{fault_id}")
    def fleet_fault_update(fault_id: int, body: dict = Body(...)) -> dict:
        return run(fleet.update_fault, fault_id, body, who(body), sync())

    @app.post("/api/fleet/vehicles/{vehicle_id}/maintenance", status_code=201)
    def fleet_maintenance_schedule(vehicle_id: int, body: dict = Body(...)) -> dict:
        return run(fleet.schedule_maintenance, vehicle_id, body, who(body), sync())

    @app.get("/api/fleet/maintenance")
    def fleet_maintenance(status: str | None = None, limit: int = 200) -> dict:
        items = fleet.list_maintenance(sync(), status, limit)
        return {"count": len(items), "items": items}

    @app.get("/api/fleet/maintenance/{maint_id}/pdf")
    def fleet_maintenance_pdf(maint_id: int, descargar: bool = False) -> Response:
        from app.engine import legal, pdf
        now = sync()
        m = read(fleet._maint_row, maint_id)
        v = read(fleet.vehicle_detail, int(m["vehicle_id"]), now)
        fault = next((f for f in v["faults"] if m.get("fault_id") and int(f["fault_id"]) == int(m["fault_id"])), None)
        data = pdf.work_order(m, v, fault, now, legal.responsible()["name"])
        disposition = "attachment" if descargar else "inline"
        return Response(data, media_type="application/pdf",
                        headers={"Content-Disposition": f'{disposition}; filename="orden-trabajo-OT-{maint_id:05d}.pdf"'})

    @app.post("/api/fleet/maintenance/{maint_id}/start")
    def fleet_maintenance_start(maint_id: int, body: dict = Body(default={})) -> dict:
        return run(fleet.start_maintenance, maint_id, who(body), sync())

    @app.post("/api/fleet/maintenance/{maint_id}/complete")
    def fleet_maintenance_complete(maint_id: int, body: dict = Body(default={})) -> dict:
        return run(fleet.complete_maintenance, maint_id, body, who(body), sync())

    @app.post("/api/fleet/maintenance/{maint_id}/cancel")
    def fleet_maintenance_cancel(maint_id: int, body: dict = Body(default={})) -> dict:
        return run(fleet.cancel_maintenance, maint_id, who(body), sync())

    @app.get("/api/fleet/drivers")
    def fleet_drivers() -> dict:
        items = fleet.list_drivers(sync())
        return {"count": len(items), "items": items}

    @app.post("/api/fleet/drivers", status_code=201)
    def fleet_driver_create(body: dict = Body(...)) -> dict:
        return run(fleet.save_driver, None, body, who(body), sync())

    @app.put("/api/fleet/drivers/{driver_id}")
    def fleet_driver_update(driver_id: int, body: dict = Body(...)) -> dict:
        return run(fleet.save_driver, driver_id, body, who(body), sync())

    @app.delete("/api/fleet/drivers/{driver_id}")
    def fleet_driver_delete(driver_id: int, usuario: str | None = None) -> dict:
        return run(fleet.delete_driver, driver_id, usuario)

    # ---------------------------------------------------------------- Bodegas
    @app.get("/api/warehouses/roles")
    def wh_roles() -> dict:
        return {"items": warehouses.roles(), "statuses": list(warehouses.STATUSES)}

    @app.get("/api/warehouses/summary")
    def wh_summary() -> dict:
        sync()
        return warehouses.summary()

    @app.get("/api/warehouses/transfers")
    def wh_transfers(limit: int = 100) -> dict:
        sync()
        items = warehouses.list_transfers(limit)
        return {"count": len(items), "items": items}

    @app.post("/api/warehouses/transfers", status_code=201)
    def wh_transfer_create(body: dict = Body(...)) -> dict:
        global_now = sync()
        return run(warehouses.create_transfer, network(), body, who(body), global_now)

    @app.get("/api/warehouses")
    def wh_list(role: str | None = None, city: str | None = None) -> dict:
        sync()
        items = [w for w in warehouses.list_warehouses()
                 if (not role or w["role"] == role) and (not city or w["city"] == city)]
        return {"count": len(items), "items": items}

    @app.post("/api/warehouses", status_code=201)
    def wh_create(body: dict = Body(...)) -> dict:
        return run(warehouses.create_warehouse, network(), body, who(body), sync())

    @app.get("/api/warehouses/{warehouse_id}")
    def wh_get(warehouse_id: int) -> dict:
        return read(warehouses.get_warehouse, warehouse_id, sync())

    @app.put("/api/warehouses/{warehouse_id}")
    def wh_update(warehouse_id: int, body: dict = Body(...)) -> dict:
        return run(warehouses.update_warehouse, network(), warehouse_id, body, who(body), sync())

    @app.delete("/api/warehouses/{warehouse_id}")
    def wh_delete(warehouse_id: int, usuario: str | None = None) -> dict:
        return run(warehouses.delete_warehouse, warehouse_id, usuario)

    @app.post("/api/warehouses/{warehouse_id}/stock", status_code=201)
    def wh_item_add(warehouse_id: int, body: dict = Body(...)) -> dict:
        return run(warehouses.add_item, warehouse_id, body, who(body), sync())

    @app.put("/api/warehouses/{warehouse_id}/stock/{sku}")
    def wh_item_update(warehouse_id: int, sku: str, body: dict = Body(...)) -> dict:
        return run(warehouses.update_item, warehouse_id, sku.upper(), body, who(body), sync())

    @app.delete("/api/warehouses/{warehouse_id}/stock/{sku}")
    def wh_item_remove(warehouse_id: int, sku: str, usuario: str | None = None) -> dict:
        return run(warehouses.remove_item, warehouse_id, sku.upper(), usuario, sync())

    @app.post("/api/warehouses/{warehouse_id}/movements", status_code=201)
    def wh_move(warehouse_id: int, body: dict = Body(...)) -> dict:
        return run(warehouses.move, warehouse_id, body, who(body), sync())
