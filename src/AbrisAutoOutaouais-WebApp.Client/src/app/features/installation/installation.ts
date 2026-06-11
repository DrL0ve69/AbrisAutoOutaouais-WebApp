import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { BookingService } from '../../core/services/booking.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import {
  AvailableSlotDto,
  BookingType,
  CreateBookingRequest,
} from '../../core/models/booking.model';

/** Créneaux regroupés par jour pour l'affichage. */
interface SlotGroup {
  readonly dayKey: string;
  readonly dayLabel: string;
  readonly slots: readonly AvailableSlotDto[];
}

/**
 * Réservation d'installation à domicile.
 * Charge les créneaux disponibles (~3 prochaines semaines), les présente en
 * radiogroup accessible groupé par jour, puis crée la réservation.
 */
@Component({
  selector: 'app-installation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './installation.html',
  styleUrl: './installation.scss',
})
export class InstallationComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly bookings = inject(BookingService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly groups = signal<readonly SlotGroup[]>([]);
  protected readonly selectedSlot = signal<string | null>(null);
  protected readonly hasSlots = computed(() => this.groups().length > 0);

  protected readonly types: readonly BookingType[] = [
    'Installation',
    'Delivery',
    'Removal',
  ];

  protected readonly form = this.fb.nonNullable.group({
    type: ['Installation' as BookingType, Validators.required],
    street: ['', Validators.required],
    city: ['', Validators.required],
    province: ['QC', Validators.required],
    postalCode: ['', Validators.required],
    notes: [''],
  });

  protected get f() {
    return this.form.controls;
  }

  ngOnInit(): void {
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 21); // ~3 prochaines semaines

    this.bookings.getAvailableSlots(this.toIsoDate(from), this.toIsoDate(to)).subscribe({
      next: slots => {
        this.groups.set(this.groupByDay(slots ?? []));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected selectSlot(start: string): void {
    this.selectedSlot.set(start);
  }

  protected confirm(): void {
    if (this.submitting()) return;

    if (!this.auth.isAuthenticated()) {
      this.toast.show(
        $localize`:@@installation.authRequired:Connectez-vous pour réserver une installation.`,
        'info',
      );
      this.router.navigateByUrl('/auth');
      return;
    }

    const slot = this.selectedSlot();
    if (!slot) {
      this.toast.show(
        $localize`:@@installation.noSlot:Veuillez choisir un créneau.`,
        'error',
      );
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const v = this.form.getRawValue();
    const request: CreateBookingRequest = {
      slotStart: slot,
      type: v.type,
      address: {
        street: v.street,
        city: v.city,
        province: v.province || 'QC',
        postalCode: v.postalCode,
        country: 'Canada',
      },
      notes: v.notes.trim() || null,
    };

    this.bookings.createBooking(request).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.show(
          $localize`:@@installation.success:Réservation confirmée !`,
          'success',
        );
        this.router.navigateByUrl('/mon-compte/reservations');
      },
      error: () => {
        this.submitting.set(false);
        this.toast.show(
          $localize`:@@installation.error:La réservation a échoué. Veuillez réessayer.`,
          'error',
        );
      },
    });
  }

  private groupByDay(slots: readonly AvailableSlotDto[]): SlotGroup[] {
    const map = new Map<string, AvailableSlotDto[]>();
    for (const slot of slots) {
      const key = slot.start.slice(0, 10);
      const bucket = map.get(key);
      if (bucket) {
        bucket.push(slot);
      } else {
        map.set(key, [slot]);
      }
    }

    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dayKey, daySlots]) => ({
        dayKey,
        dayLabel: new Date(daySlots[0].start).toLocaleDateString('fr-CA', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }),
        slots: daySlots,
      }));
  }

  private toIsoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
}
