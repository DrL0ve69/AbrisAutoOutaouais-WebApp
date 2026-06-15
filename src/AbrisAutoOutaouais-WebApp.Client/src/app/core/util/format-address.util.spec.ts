import { describe, it, expect } from 'vitest';
import { formatAddressLine } from './format-address.util';
import { AddressDto } from '../models/booking.model';

const BASE: AddressDto = {
  civicNumber: '111',
  street: 'rue Wellington',
  apartment: '4B',
  city: 'Ottawa',
  province: 'ON',
  postalCode: 'K1A 0A6',
  country: 'Canada',
};

describe('formatAddressLine', () => {
  it('met en forme une adresse complète avec appartement', () => {
    expect(formatAddressLine(BASE)).toBe('111 rue Wellington, app. 4B, Ottawa, ON K1A 0A6');
  });

  it('omet le segment appartement quand il est null', () => {
    expect(formatAddressLine({ ...BASE, apartment: null })).toBe(
      '111 rue Wellington, Ottawa, ON K1A 0A6',
    );
  });

  it('omet le segment appartement quand il est une chaîne vide ou des espaces', () => {
    expect(formatAddressLine({ ...BASE, apartment: '   ' })).toBe(
      '111 rue Wellington, Ottawa, ON K1A 0A6',
    );
  });

  it('colle province et code postal par une espace', () => {
    expect(formatAddressLine({ ...BASE, apartment: null })).toContain('ON K1A 0A6');
  });

  it('reste robuste si le code postal manque (ne laisse pas de virgule pendante)', () => {
    expect(formatAddressLine({ ...BASE, apartment: null, postalCode: '' })).toBe(
      '111 rue Wellington, Ottawa, ON',
    );
  });
});
