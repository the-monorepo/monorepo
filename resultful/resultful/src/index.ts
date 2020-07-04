import * as ResultTypes from '@resultful/types';
export { ResultTypes };

/**
 * Signifies that something 'worked'. Also known as a "happy path" result.
 */
export type SuccessResult<P> = {
  type: typeof ResultTypes.SUCCESS,
  payload: P,
  /**
   * Only defined for {@link ErrorResult}
   */
  error: undefined,
  /**
   * Only defined for {@link ExceptionResult}
   */
  exception: undefined,
};

/**
 * Signifies that some erroneuous (but known/anticipated) behaviour has ocurred.
 * The difference between this and {@exception} is that this form of error is known to be possible of occuring.
 */
export type ErrorResult<E> = {
  type: typeof ResultTypes.ERROR,
  /**
   * Only defined for {@link SuccessResult}
   */
  payload: undefined,
  error: E,
  /**
   * Only defined for {@link ExceptionResult}
   */
  exception: undefined
};

/**
 * Signifies that some UNEXPECTED erroneuous behaviour has occurred.
 * This result occurs when there is a bug in the API being consumed or the consumer is consuming the API incorrectly
 * and API has not accounted for such misuse.
 */
export type ExceptionResult<T> = {
  type: typeof ResultTypes.EXCEPTION;
  /**
   * Only defined for {@link SuccessResult}
   */
  payload: undefined;
  /**
   * Only defined for {@link ErrorResult}
   */
  error: undefined;
  exception: T;
};

export type FailureResult<E, EX = any> = ErrorResult<E> | ExceptionResult<EX>;

export type Result<P, E, EX = any> =
  | SuccessResult<P>
  | ErrorResult<E>
  | ExceptionResult<EX>;

/**
 * Check if a result is an {@link ExceptionResult}.
 * @param result being checked
 * @return Returning true signifies that some unexpected (i.e. API creator did not expect/account for the errror) erroneuous behaviour has occurred.
 */
export const isException = <EX = any>(
  result: Result<unknown, unknown, EX>,
): result is ExceptionResult<EX> => result.type === ResultTypes.EXCEPTION;

/**
 * Check if a result is an {@link ErrorResult}.
 * @param result being checked
 * @return Returning true signifies expected (i.e. API creator is aware of the error) erroneuous behaviour has occurred.
 */
export const isError = <R extends ResultSchema>(result: R): result is Include<R, TypeHolder<typeof ResultTypes.ERROR>> =>
  result.type === ResultTypes.ERROR;

type Include<Type, Included> = Exclude<Type, Exclude<Type, Included>>;

/**
 * Check if a result is a {@link SuccessResult}.
 * @param result being checked
 * @return Returning true signifies successful/"happy path" behaviour has occurred.
 */
export const isSuccess = <R extends ResultSchema>(result: R): result is Include<R, TypeHolder<typeof ResultTypes.SUCCESS>> =>
  result.type === ResultTypes.SUCCESS;

/**
 * Checks if a result is a {@link FailureResult}.
 * @param result being checked
 * @returns Returning true signifies that erroneous behaviour has occurred (i.e. An {@link exception} or an {@link error}).
 */
export const isFailure = <R extends ResultSchema>(
  result: R,
): result is Include<R, TypeHolder<typeof ResultTypes.ERROR | typeof ResultTypes.EXCEPTION>> => {
  switch (result.type) {
    case ResultTypes.ERROR:
    case ResultTypes.EXCEPTION: {
      return true;
    }
    default:
      return false;
  }
};

export type CreateSuccessFn = {
  <P>(payload: P): SuccessResult<P>;
  (payload?: undefined): SuccessResult<undefined>;
};
/**
 * Use this to create a {@link SuccessResult} which signifies that something successful
 * has happened and your API has run as expected and has been consumed correctly (AKA the "happy path").
 */
export const success: CreateSuccessFn = <P>(payload: P): SuccessResult<P> => ({
  type: ResultTypes.SUCCESS,
  payload,
  error: undefined,
  exception: undefined,
});

export type CreateErrorFn = {
  <E>(error: E): ErrorResult<E>;
  (error?: undefined): ErrorResult<undefined>;
};
/**
 * Use this to create an {@link ErrorResult} which signifies that either your API has behaved erroneuously in some way but
 * you're aware that the error can occur.
 */
export const error: CreateErrorFn = <E>(error: E): ErrorResult<E> => ({
  type: ResultTypes.ERROR,
  payload: undefined,
  error: error,
  exception: undefined,
});

export type CreateExceptionFn = {
  <EX>(exception: EX): ExceptionResult<EX>;
  (exception?: undefined): ExceptionResult<undefined>;
};
/**
 * Use this to create an {@link ExceptionResult} which signifies that some unexpected,
 * thought-to-be-impossible/didn't-think-about-it type erroneous behaviour has ocurred.
 */
export const exception: CreateExceptionFn = <EX>(exception: EX): ExceptionResult<EX> => {
  return {
    type: ResultTypes.EXCEPTION,
    payload: undefined,
    error: undefined,
    exception,
  };
};

export type SimpleHandleCallback<T, V, R> = (value: V, result: T) => R;

export type SuccessCallback<T, R> = SimpleHandleCallback<SuccessResult<T>, T, R>;
export type ErrorCallback<E, R> = SimpleHandleCallback<ErrorResult<E>, E, R>;
export type ExceptionCallback<EX, R> = SimpleHandleCallback<ExceptionResult<EX>, EX, R>;

type HandleSuccessOptions<P, PR> = {
  payload: SuccessCallback<P, PR>;
};

type HandleErrorOptions<E, ER> = {
  error: ErrorCallback<E, ER>;
};

type HandleExceptionOptions<EX, EXR> = {
  exception: ExceptionCallback<EX, EXR>;
};

export type FullHandleOptions<P, E, EX, PR, ER, EXR> = HandleSuccessOptions<P, PR> &
HandleErrorOptions<E, ER> &
HandleExceptionOptions<EX, EXR>;

export type HandleOptions<P, E, EX, PR, ER, EXR> = Partial<FullHandleOptions<P, E, EX, PR, ER, EXR>>;

export type AnyHandleOptions = HandleOptions<any, any, any, any, any, any>;
export type AnyResult = Result<any, any, any>;

type NonUndefined<T> = Exclude<T, undefined>;

export type OptionSchema = { [s: string]: ((...args: any[]) => any) | undefined };
export type TypeHolder<T> = { type: T };
export type ResultSchema = TypeHolder<string>;

export type HandledResultType<
  ResultObjectType extends ResultSchema,
  OptionsObjectType extends OptionSchema,
  OptionsKey extends keyof OptionsObjectType,
  ResultType extends ResultObjectType['type']
> = ResultObjectType['type'] extends ResultType
? OptionsKey extends never ? ResultObjectType : ReturnType<NonUndefined<OptionsObjectType[OptionsKey]>>
: ResultObjectType;

export type HandledSuccessResult<
  R extends ResultSchema,
  O extends OptionSchema,
> = HandledResultType<
  R,
  O,
  'payload',
  typeof ResultTypes.SUCCESS
>;

export type HandledExceptionResult<
  R extends ResultSchema,
  O extends OptionSchema
> = HandledResultType<
  R,
  O,
  'exception',
  typeof ResultTypes.EXCEPTION
>;

export type HandledErrorResult<
  R extends ResultSchema,
  O extends OptionSchema
> = HandledResultType<
  R,
  O,
  'error',
  typeof ResultTypes.ERROR
>;

export type HandledResult<R extends ResultSchema, O extends OptionSchema> =
  | HandledSuccessResult<R, O>
  | HandledErrorResult<R, O>
  | HandledExceptionResult<R, O>;


export type CatchlessHandle = {
  <P, E, EX, R extends Result<P, E, EX>>(result: R, options?: undefined): typeof result;
  <
    R extends AnyResult,
    O extends HandleOptions<R['payload'], R['error'], R['exception'], any, any, any>
  >(
    result: R,
    options: O,
  ): HandledResult<typeof result, typeof options>;
  <P, E, EX, PR, ER, EXR>(
    result: Result<P, E, EX>,
    options: HandleOptions<P, E, EX, PR, ER, EXR>,
  ): typeof result | PR | ER | EXR;
};
  
/**
 * This is exactly the same as {@link handle} except there is no try { ... } catch { ... } wrapper around the handlers.
 * This may improve performance but removes the guarentee that nothing will ever be thrown by the handle function.
 */
export const catchlessHandle: CatchlessHandle = <P, E, EX, PR, ER, EXR>(
  result: Result<P, E, EX>,
  handlers: HandleOptions<P, E, EX, PR, ER, EXR> = {},
) => {
  switch (result.type) {
    case ResultTypes.SUCCESS: {
      const { payload } = result;
      if (handlers.payload !== undefined) {
        return handlers.payload(payload, result);
      }
      break;
    }

    case ResultTypes.ERROR: {
      const { error } = result;
      if (handlers.error !== undefined) {
        return handlers.error(error, result);
      }
      break;
    }

    case ResultTypes.EXCEPTION: {
      const { exception } = result;
      if (handlers.exception !== undefined) {
        return handlers.exception(exception, result);
      }
      break;
    }
  }

  return result;
};

export type HandleFn = {
  <P, E, EX, R extends Result<P, E, EX>>(result: R, options?: undefined): typeof result | ExceptionResult<any>;
  <
    R extends AnyResult,
    O extends HandleOptions<R['payload'], R['error'], R['exception'], any, any, any>
  >(
    result: R,
    options: O,
  ): HandledResult<typeof result, typeof options> | ExceptionResult<any>;
  <P, E, EX, PR, ER, EXR>(
    result: Result<P, E, EX>,
    options: HandleOptions<P, E, EX, PR, ER, EXR>,
  ): typeof result | PR | ER | EXR | ExceptionResult<any>;
};

/**
 * A helper function which executes a relevant handler based on the type of result that is passed into the function.
 * @param result The result that will be handled by one of the applicable handlers
 * @param handlers Callbacks that are used
 * @return Returns whatever is returned by the applicable handler. If no handler for the result exists, the orignal result is returned. Note that if something is thrown by one of the handlers, it is caught by this function and the value of what is caught is returned as via {@link exception}.
 */
export const handle: HandleFn = <P, E, EX, PR, ER, EXR, FR>(
  result: Result<P, E, EX>,
  handlers: HandleOptions<P, E, EX, PR, ER, EXR> = {},
) => {
  try {
    return catchlessHandle(result, handlers);
  } catch (err) {
    return exception(err);
  }
};
