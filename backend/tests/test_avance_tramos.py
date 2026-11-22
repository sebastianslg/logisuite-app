from app.api.serializers import progress_legs


def test_avance_respeta_distancias_y_espera_en_el_transbordo():
    legs = [
        {"mode": "fluvial", "distance_km": 100, "start_h": 0, "end_h": 10},
        {"mode": "terrestre", "distance_km": 300, "start_h": 12, "end_h": 16},
    ]
    assert progress_legs(legs, 11) == [["fluvial", 100, 1], ["terrestre", 300, 0]]
    assert progress_legs(legs, 13)[1] == ["terrestre", 300, 0.25]
    assert progress_legs([], 0) == []
