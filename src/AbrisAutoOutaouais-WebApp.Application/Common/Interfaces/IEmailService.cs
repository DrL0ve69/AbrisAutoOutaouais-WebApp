using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;

public interface IEmailService
{
    Task SendOrderConfirmationAsync(Guid orderId, string toEmail, CancellationToken ct = default);
    Task SendBookingConfirmationAsync(Guid bookingId, string toEmail, CancellationToken ct = default);
    Task SendRentalContractAsync(Guid rentalId, string toEmail, CancellationToken ct = default);
    Task SendPasswordResetAsync(string toEmail, string resetLink, CancellationToken ct = default);
}
