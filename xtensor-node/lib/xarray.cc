#include "xarray.h"
#include "xtensor/xadapt.hpp"

using namespace Napi;

XArray::XArray(const Napi::CallbackInfo & info) : ObjectWrap(info){
    auto env = info.Env();
    std::vector<double> data;
    std::vector<std::size_t> shape;

    if(info.Length() > 0 && info[0].IsArray()){
        auto nodeNums = info[0].As<Napi::Array>();

        for(int i = 0; i < nodeNums.Length(); i++){
            auto num = nodeNums.Get(i).As<Napi::Number>();
            data.push_back(num.DoubleValue());
        }

        if(info.Length() > 1 && info[0].IsArray()){
            auto dims = info[1].As<Napi::Array>();

            for(int i = 0; i < dims.Length(); i++){
                shape.push_back(dims.Get(i).As<Napi::Number>().Int64Value());
            }
        }
    }

    if(shape.size() == 0){
        shape.push_back(data.size());
    }

    m_array = xt::adapt(data,shape);
}

Napi::Value XArray::Test(const Napi::CallbackInfo & info){

    return Napi::String::New(info.Env(),"THIS IS FROM C++");
}

Napi::Value XArray::Shape(const Napi::CallbackInfo & info)
{
    auto env = info.Env();
    auto shape = m_array.shape();
    auto nodeReturn = Napi::Array::New(env,shape.size());
    int idx = 0;
    for(auto dim : shape){
        nodeReturn.Set(idx,dim);
        idx++;
    }

    return nodeReturn;
}

Napi::Function XArray::GetClass(Napi::Env env){
    return DefineClass(env,"XArray",{
        XArray::InstanceMethod("test",&XArray::Test),
        XArray::InstanceMethod("shape",&XArray::Shape),
    });
}

Napi::Object Init (Napi::Env env, Napi::Object exports){
    auto name = Napi::String::New(env,"XArray");
    exports.Set(name,XArray::GetClass(env));
    return exports;
}

NODE_API_MODULE(addon,Init)
    