using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

public interface ICommand<TResult> { }
public interface ICommand : ICommand<Unit> { }  // commande sans retour
