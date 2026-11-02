// Command snapshotfixture writes the backend snapshot the Android app's
// one-time import is tested against. It runs the real backend migrations and
// writes a small known cellar through the backend's own db layer, so the file
// has exactly the schema and value formats a real snapshot has.
//
// Run from the repo root:
//
//	go run ./android/Oenoteq/tools/snapshotfixture android/Oenoteq/app/src/test/resources/snapshot/backend-snapshot.db
//
// The expected contents are asserted in SnapshotImporterTest; change both together.
package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/younited/wine-cellar-tracker/internal/db"
)

func main() {
	if len(os.Args) != 2 {
		log.Fatal("usage: snapshotfixture <output.db>")
	}
	out := os.Args[1]
	for _, suffix := range []string{"", "-wal", "-shm"} {
		if err := os.Remove(out + suffix); err != nil && !os.IsNotExist(err) {
			log.Fatal(err)
		}
	}

	ctx := context.Background()
	d, err := db.Open(out)
	if err != nil {
		log.Fatal(err)
	}
	if err := d.Migrate(ctx); err != nil {
		log.Fatal(err)
	}
	if err := seed(ctx, d); err != nil {
		log.Fatal(err)
	}
	// Fold the WAL into the main file, as `sqlite3 .backup` does for a real snapshot.
	if _, err := d.ExecContext(ctx, "PRAGMA wal_checkpoint(TRUNCATE)"); err != nil {
		log.Fatal(err)
	}
	if err := d.Close(); err != nil {
		log.Fatal(err)
	}
	for _, suffix := range []string{"-wal", "-shm"} {
		os.Remove(out + suffix)
	}
	fmt.Println("wrote", out)
}

func ptr[T any](v T) *T { return &v }

func must[T any](v T, err error) T {
	if err != nil {
		log.Fatal(err)
	}
	return v
}

func seed(ctx context.Context, d *db.DB) error {
	margaux := must(d.CreateAppellation(ctx, "Margaux", ptr("a-margaux")))
	chablis := must(d.CreateAppellation(ctx, "Chablis", nil))
	provence := must(d.CreateAppellation(ctx, "Côtes de Provence", nil))
	champagne := must(d.CreateAppellation(ctx, "Champagne", nil))

	palmer := must(d.CreateProducer(ctx, "Château Palmer", ptr("p-palmer")))
	laroche := must(d.CreateProducer(ctx, "Domaine Laroche", nil))
	esclans := must(d.CreateProducer(ctx, "Château d'Esclans", nil))
	bollinger := must(d.CreateProducer(ctx, "Bollinger", nil))

	agneau := must(d.CreateMeal(ctx, "Agneau rôti", ptr("m-agneau")))
	huitres := must(d.CreateMeal(ctx, "Huîtres", nil))
	salade := must(d.CreateMeal(ctx, "Salade niçoise", nil))
	must(d.CreateMeal(ctx, "Plateau de fromages", nil)) // a Meal with no pairing

	// Ready, two Consumptions, one manual correction: 6 - 2 + 1 = 5.
	w1 := must(d.CreateWine(ctx, db.Wine{
		ClientID: ptr("w-palmer-2015"), Millesime: ptr(2015), AppellationID: margaux.ID, ProducerID: palmer.ID,
		Color: "rouge", GardeDebut: ptr(2022), GardeFin: ptr(2040),
	}, 6))
	// Finished: 1 - 1 = 0, stays as a record.
	w2 := must(d.CreateWine(ctx, db.Wine{
		Millesime: ptr(2020), AppellationID: chablis.ID, ProducerID: laroche.ID,
		Color: "blanc", GardeDebut: ptr(2021), GardeFin: ptr(2026),
	}, 1))
	// Unassessed garde: 3.
	must(d.CreateWine(ctx, db.Wine{
		Millesime: ptr(2023), AppellationID: provence.ID, ProducerID: esclans.ID,
		Color: "rose",
	}, 3))
	// Non-vintage, garde start only, one manual correction: 2 - 1 = 1.
	w4 := must(d.CreateWine(ctx, db.Wine{
		AppellationID: champagne.ID, ProducerID: bollinger.ID,
		Color: "blanc", GardeDebut: ptr(2024),
	}, 2))

	must(d.CreateConsumption(ctx, db.Consumption{
		ClientID: ptr("c-palmer-1"), WineID: w1.ID, Date: "2025-12-24", Rating: ptr(5), Notes: ptr("Superbe, encore jeune"),
	}))
	must(d.CreateConsumption(ctx, db.Consumption{WineID: w1.ID, Date: "2026-03-15"}))
	must(d.CreateConsumption(ctx, db.Consumption{WineID: w2.ID, Date: "2026-05-01", Rating: ptr(4)}))

	must(d.ApplyQuantityAdjustment(ctx, db.QuantityAdjustment{ClientID: ptr("q-palmer-1"), WineID: w1.ID, Delta: 1}))
	must(d.ApplyQuantityAdjustment(ctx, db.QuantityAdjustment{WineID: w4.ID, Delta: -1}))

	for _, p := range []struct {
		appellation int
		color       string
		meal        int
	}{
		{margaux.ID, "rouge", agneau.ID},
		{chablis.ID, "blanc", huitres.ID},
		{provence.ID, "rose", salade.ID},
	} {
		if err := d.CreateMealPairing(ctx, p.appellation, p.color, p.meal); err != nil {
			return err
		}
	}
	return nil
}
