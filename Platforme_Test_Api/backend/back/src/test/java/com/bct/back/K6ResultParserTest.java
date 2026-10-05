package com.bct.back;

import com.bct.back.DTO.TestCaseSnapshot;
import com.bct.back.entities.Execution;
import com.bct.back.enums.ExecutionMode;
import com.bct.back.enums.TestStatus;
import com.bct.back.services.K6ResultParser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests unitaires du calcul du verdict d'une exécution k6.
 * Chaque test fabrique un faux rapport k6 dont on connaît à l'avance le résultat attendu.
 */
class K6ResultParserTest {

    private final K6ResultParser parser = new K6ResultParser();

    private TestCaseSnapshot snapshot() {
        return new TestCaseSnapshot(1L, "http://api-test.local/clients", "GET", "{}", null,
                200, 5000, 1000, 0.05, 10, ExecutionMode.DUREE, 30, null);
    }

    /** Construit un rapport k6 minimal : nombre de requêtes, p95, taux d'erreur, seuils respectés ou non. */
    private String rapportK6(long requetes, double p95, double tauxErreur, boolean seuilP95Ok, boolean seuilErreurOk) {
        return """
            {"metrics": {
              "http_reqs": {"values": {"count": %d, "rate": 10.0}},
              "http_req_duration": {"values": {"p(95)": %s},
                                    "thresholds": {"p(95)<1000": {"ok": %s}}},
              "status_mismatch_rate": {"values": {"rate": %s},
                                       "thresholds": {"rate<0.05": {"ok": %s}}}
            }}""".formatted(requetes, p95, seuilP95Ok, tauxErreur, seuilErreurOk);
    }

    private Execution analyser(String rapport) {
        return parser.parse(rapport, "", snapshot(), "corr-id", LocalDateTime.now());
    }

    @Test
    @DisplayName("Tous les seuils respectés → REUSSIE")
    void seuilsRespectes_donneReussie() {
        Execution e = analyser(rapportK6(100, 300, 0.0, true, true));

        assertEquals(TestStatus.REUSSIE, e.getStatut());
        assertEquals(100, e.getReqTotal());
        assertEquals(100, e.getReqReussies());
        assertEquals(0, e.getReqEchouees());
        assertEquals(300, e.getP95MesureMs());
    }

    @Test
    @DisplayName("Seuil dépassé mais 70 % de réussite → PARTIELLE, 140 réussies / 60 échouées")
    void seuilDepasse_majoriteReussie_donnePartielle() {
        // 200 requêtes × 30 % d'erreur = 60 échouées, 140 réussies (70 % ≥ 50 %)
        Execution e = analyser(rapportK6(200, 1500, 0.30, false, false));

        assertEquals(TestStatus.PARTIELLE, e.getStatut());
        assertEquals(140, e.getReqReussies());
        assertEquals(60, e.getReqEchouees());
        assertEquals(30.0, e.getTauxErreurMesure(), 0.001);
    }

    @Test
    @DisplayName("Moins de 50 % de réussite → ECHOUEE")
    void minoriteReussie_donneEchouee() {
        // 100 requêtes × 80 % d'erreur = 20 réussies seulement
        Execution e = analyser(rapportK6(100, 2000, 0.80, false, false));

        assertEquals(TestStatus.ECHOUEE, e.getStatut());
        assertEquals(20, e.getReqReussies());
    }

    @Test
    @DisplayName("Cas limite : exactement 50 % de réussite → PARTIELLE")
    void exactementCinquantePourcent_donnePartielle() {
        Execution e = analyser(rapportK6(100, 1200, 0.50, false, false));

        assertEquals(TestStatus.PARTIELLE, e.getStatut());
    }

    @Test
    @DisplayName("Cas limite : aucune requête exécutée → ECHOUEE (jamais REUSSIE)")
    void aucuneRequete_donneEchouee() {
        Execution e = analyser(rapportK6(0, 0, 0.0, true, true));

        assertEquals(TestStatus.ECHOUEE, e.getStatut());
        assertEquals(0, e.getReqTotal());
    }

    @Test
    @DisplayName("Rapport k6 illisible → ECHOUEE avec message, sans exception")
    void rapportInvalide_donneEchoueeSansPlanter() {
        Execution e = assertDoesNotThrow(() -> analyser("ceci n'est pas du JSON"));

        assertEquals(TestStatus.ECHOUEE, e.getStatut());
        assertTrue(e.getRapportK6Json().startsWith("Erreur d'analyse du rapport k6"));
    }

    @Test
    @DisplayName("Les variantes de réponses sont comptées et associées à leur aperçu")
    void variantesDeReponses_sontRegroupees() {
        String rapport = """
            {"metrics": {"http_reqs": {"values": {"count": 10, "rate": 1}},
                         "status_mismatch_rate": {"values": {"rate": 0}}},
             "root_group": {"checks": [
               {"name": "response body variant: aaa111", "passes": 7},
               {"name": "response body variant: bbb222", "passes": 3}
             ]}}""";
        String console = "INFO[0001] BODY_SAMPLE|aaa111|{\"id\":1}\nINFO[0002] BODY_SAMPLE|bbb222|{\"erreur\":true}";

        Execution e = parser.parse(rapport, console, snapshot(), "corr-id", LocalDateTime.now());

        String variantes = e.getCorpsReponsesJson();
        assertNotNull(variantes);
        assertTrue(variantes.indexOf("\"count\":7") < variantes.indexOf("\"count\":3"),
                "la variante la plus fréquente doit apparaître en premier");
        assertTrue(variantes.contains("{\\\"id\\\":1}"));
    }
}