#include <napi.h>

#include "xtensor/xarray.hpp"
#include "xtensor/xio.hpp"
#include "xtensor/xview.hpp"
#include "xtensor/xadapt.hpp"

class XTensor : public Napi::ObjectWrap<XTensor>
{
public:
    XTensor(const Napi::CallbackInfo &);
    Napi::Value Greet(const Napi::CallbackInfo &);

    static Napi::Function GetClass(Napi::Env);
    xt::xarray<double> array;
};
