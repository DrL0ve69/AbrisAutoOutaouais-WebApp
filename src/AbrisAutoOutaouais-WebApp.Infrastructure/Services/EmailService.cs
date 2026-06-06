using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Services;

internal class EmailService : IEmailService
{
    public Task SendBookingConfirmationAsync(Guid bookingId, string toEmail, CancellationToken ct = default)
    {
        throw new NotImplementedException();
    }

    public Task SendOrderConfirmationAsync(Guid orderId, string toEmail, CancellationToken ct = default)
    {
        throw new NotImplementedException();
    }

    public Task SendPasswordResetAsync(string toEmail, string resetLink, CancellationToken ct = default)
    {
        throw new NotImplementedException();
    }

    public Task SendRentalContractAsync(Guid rentalId, string toEmail, CancellationToken ct = default)
    {
        throw new NotImplementedException();
    }
}
