#include <napi.h>

#include "xtensor/xarray.hpp"
#include "xtensor/xio.hpp"
#include "xtensor/xview.hpp"


class XArray : public Napi::ObjectWrap<XArray>
{
public:
    XArray(const Napi::CallbackInfo &);
    Napi::Value Test(const Napi::CallbackInfo &);

    Napi::Value Shape(const Napi::CallbackInfo &);

    static Napi::Function GetClass(Napi::Env);
    xt::xarray<double> m_array;
};
