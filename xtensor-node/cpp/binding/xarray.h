#include <napi.h>

#include "xtensor/xarray.hpp"
#include "xtensor/xio.hpp"
#include "xtensor/xview.hpp"
#include <string>

enum EXArrayType
{
    FLOAT,
    INTEGER,
    DOUBLE
};

template <typename T>
class Tensor : public Napi::ObjectWrap<Tensor<T>>
{
public:
    Tensor(const Napi::CallbackInfo &);

    Napi::Value Shape(const Napi::CallbackInfo &);

    Napi::Value ToArray(const Napi::CallbackInfo &);

    EXArrayType GetType();

    static Napi::Function GetClass(Napi::Env);

    xt::xarray<T> m_array;
    std::string type;
};
